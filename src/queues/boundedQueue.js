class BoundedQueue {
  constructor(name, maxSize = 100, onOverflow = 'drop_oldest') {
    this.name = name;
    this.maxSize = maxSize;
    this.onOverflow = onOverflow; // 'drop_oldest' | 'reject'
    this.queue = [];
    this.totalEnqueued = 0;
    this.totalDequeued = 0;
    this.totalDropped = 0;
  }

  enqueue(item) {
    if (this.queue.length >= this.maxSize) {
      this.totalDropped++;
      if (this.onOverflow === 'drop_oldest') {
        this.queue.shift(); // Drop oldest element to keep pipeline responsive
      } else {
        throw new Error(`Queue ${this.name} overflowed (capacity: ${this.maxSize})`);
      }
    }
    this.queue.push(item);
    this.totalEnqueued++;
    return true;
  }

  dequeue() {
    if (this.queue.length === 0) return null;
    this.totalDequeued++;
    return this.queue.shift();
  }

  peek() {
    return this.queue.length > 0 ? this.queue[0] : null;
  }

  size() {
    return this.queue.length;
  }

  isEmpty() {
    return this.queue.length === 0;
  }

  clear() {
    this.queue = [];
  }

  getMetrics() {
    return {
      name: this.name,
      currentDepth: this.queue.length,
      maxCapacity: this.maxSize,
      totalEnqueued: this.totalEnqueued,
      totalDequeued: this.totalDequeued,
      totalDropped: this.totalDropped,
    };
  }
}

module.exports = BoundedQueue;
