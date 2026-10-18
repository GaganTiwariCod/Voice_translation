import asyncio
import json
import logging
import math
import os
import struct
import sys

try:
    import vosk
    HAS_VOSK = True
except ImportError:
    vosk = None
    HAS_VOSK = False

import websockets
import speech_recognition as sr

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s'
)
logger = logging.getLogger('vosk_server')

MODELS = {}
sr_recognizer = sr.Recognizer()

def load_models():
    if not HAS_VOSK:
        logger.info("Vosk offline library not available (Termux/Mobile mode). Speech recognition will use high-accuracy online engine for all languages.")
        return

    logger.info("Initializing Vosk models...")
    try:
        MODELS['en'] = vosk.Model(lang="en-us")
        logger.info("English model (en-us) loaded.")
    except Exception as e:
        logger.error(f"Failed to load English model: {e}")

    try:
        MODELS['hi'] = vosk.Model(lang="hi")
        logger.info("Hindi model (hi) loaded.")
    except Exception as e:
        logger.error(f"Failed to load Hindi model: {e}")

def get_model(lang_code):
    clean = (lang_code or 'en').split('-')[0].lower()
    if clean in MODELS:
        return MODELS[clean]
    if 'en' in MODELS:
        return MODELS['en']
    return next(iter(MODELS.values()), None)

def get_rms(data):
    if len(data) < 2:
        return 0
    count = len(data) // 2
    shorts = struct.unpack(f"<{count}h", data[:count * 2])
    return math.sqrt(sum(s * s for s in shorts) / count)

SR_LANGUAGE_MAP = {
    'gu': 'gu-IN',
    'bn': 'bn-IN',
    'ta': 'ta-IN',
    'te': 'te-IN',
    'mr': 'mr-IN',
    'hi': 'hi-IN',
    'en': 'en-IN',
    'es': 'es-ES',
    'fr': 'fr-FR',
    'de': 'de-DE',
}

ONLINE_LANGUAGES = {'gu', 'bn', 'ta', 'te', 'mr'}

def get_sr_language(lang_code):
    clean = (lang_code or 'en').split('-')[0].lower()
    return SR_LANGUAGE_MAP.get(clean, f"{clean}-IN")

def transcribe_online(pcm_bytes, sample_rate, lang_code):
    try:
        audio = sr.AudioData(bytes(pcm_bytes), sample_rate, 2)
        sr_lang = get_sr_language(lang_code)
        text = sr_recognizer.recognize_google(audio, language=sr_lang)
        return text.strip() if text else ""
    except (sr.UnknownValueError, sr.RequestError):
        return ""
    except Exception as e:
        logger.warning(f"Online recognition error ({lang_code}): {e}")
        return ""

async def handle_client(websocket):
    client_addr = websocket.remote_address
    logger.info(f"Client connected: {client_addr}")

    model = MODELS.get('en')
    sample_rate = 16000
    recognizer = None
    lang = 'en'
    use_online = False

    # Audio state for low-latency VAD (Gujarati, Bengali, Tamil, Telugu, Marathi)
    audio_buffer = bytearray()
    has_speech = False
    silence_frames = 0
    pre_speech_buffer = bytearray()

    async def flush_audio_buffer():
        nonlocal has_speech, silence_frames
        if len(audio_buffer) >= 6400: # At least 0.2s of audio (fast short phrases)
            pcm_to_send = bytes(audio_buffer)
            audio_buffer.clear()
            has_speech = False
            silence_frames = 0
            text = await asyncio.to_thread(transcribe_online, pcm_to_send, sample_rate, lang)
            if text:
                logger.info(f"Final recognized ({lang} / {get_sr_language(lang)}): '{text}'")
                try:
                    await websocket.send(json.dumps({"text": text}))
                except Exception:
                    pass
        else:
            audio_buffer.clear()
            has_speech = False
            silence_frames = 0

    try:
        async for message in websocket:
            # Check if initial JSON config or EOF command
            if isinstance(message, str):
                try:
                    data = json.loads(message)
                except Exception:
                    continue

                if "config" in data:
                    cfg = data["config"]
                    sample_rate = int(cfg.get("sample_rate", 16000))
                    use_online = (not HAS_VOSK) or (lang in ONLINE_LANGUAGES) or (lang not in MODELS)

                    if not use_online and HAS_VOSK and vosk is not None:
                        model = get_model(lang)
                        if model:
                            recognizer = vosk.KaldiRecognizer(model, sample_rate)
                            recognizer.SetWords(True)
                        else:
                            use_online = True

                    audio_buffer.clear()
                    pre_speech_buffer.clear()
                    has_speech = False
                    silence_frames = 0
                    logger.info(f"Session configured: lang={lang}, use_online={use_online}, sample_rate={sample_rate}")

                elif "eof" in data:
                    if use_online:
                        await flush_audio_buffer()
                    elif recognizer:
                        final_data = json.loads(recognizer.FinalResult())
                        text = final_data.get("text", "").strip()
                        if text:
                            logger.info(f"Final recognized (EOF): '{text}'")
                            await websocket.send(json.dumps({"text": text}))
                        recognizer = vosk.KaldiRecognizer(model, sample_rate)
                        recognizer.SetWords(True)

            elif isinstance(message, bytes):
                # Raw PCM 16-bit Mono Audio Frame
                if use_online:
                    rms = get_rms(message)

                    # Sensitive threshold: 60 RMS detects conversational voice and whisper
                    if rms >= 60:
                        if not has_speech:
                            # Attach pre-speech audio for clean initial consonants
                            if len(pre_speech_buffer) > 0:
                                audio_buffer.extend(pre_speech_buffer)
                                pre_speech_buffer.clear()
                            has_speech = True

                        audio_buffer.extend(message)
                        silence_frames = 0

                        # Fast continuous speech boundary: cut at ~1.8s (57,600 bytes)
                        if len(audio_buffer) >= 57600:
                            await flush_audio_buffer()
                    elif has_speech:
                        # User was speaking and is now pausing
                        audio_buffer.extend(message)
                        silence_frames += 1

                        # Natural fast conversational pause detected (~280ms = 3 frames)
                        if silence_frames >= 3:
                            await flush_audio_buffer()
                    else:
                        # Pre-speech buffer: keep the last 1 frame (3200 bytes)
                        pre_speech_buffer = bytearray(message)
                else:
                    if recognizer is None:
                        if HAS_VOSK and vosk is not None and ('en' in MODELS):
                            model = MODELS.get('en')
                            recognizer = vosk.KaldiRecognizer(model, sample_rate)
                            recognizer.SetWords(True)
                        else:
                            use_online = True
                            continue

                    rms = get_rms(message)
                    if rms >= 60:
                        has_speech = True
                        silence_frames = 0
                    elif has_speech:
                        silence_frames += 1

                    if recognizer.AcceptWaveform(message):
                        res = json.loads(recognizer.Result())
                        text = res.get("text", "").strip()
                        if text:
                            logger.info(f"Final recognized: '{text}'")
                            await websocket.send(json.dumps({"text": text}))
                        has_speech = False
                        silence_frames = 0
                    elif has_speech and silence_frames >= 3:
                        # Fast flush on natural conversational pause (~280ms)
                        res = json.loads(recognizer.Result())
                        text = res.get("text", "").strip()
                        if text:
                            logger.info(f"Final recognized (VAD silence trigger): '{text}'")
                            await websocket.send(json.dumps({"text": text}))
                        has_speech = False
                        silence_frames = 0
                    else:
                        part = json.loads(recognizer.PartialResult())
                        partial_text = part.get("partial", "").strip()
                        if partial_text:
                            await websocket.send(json.dumps({"partial": partial_text}))

    except websockets.exceptions.ConnectionClosed:
        logger.info(f"Client disconnected: {client_addr}")
    except Exception as e:
        logger.error(f"Error handling client {client_addr}: {e}")

async def main():
    load_models()
    port = int(os.environ.get("VOSK_PORT", 2700))
    host = os.environ.get("VOSK_HOST", "127.0.0.1")

    logger.info(f"Starting Vosk STT Sidecar WebSocket Server on ws://{host}:{port}...")
    async with websockets.serve(handle_client, host, port):
        logger.info(f"Vosk STT Sidecar ready and accepting audio streams on port {port}.")
        await asyncio.Future()

if __name__ == '__main__':
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Vosk STT Sidecar stopped.")
