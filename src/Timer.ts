export class Timer {
    private callback: () => void;
    private timeInterval: number;
    private expected = 0;
    private timeout?: ReturnType<typeof setTimeout>;

    constructor(callback: () => void, timeInterval: number) {
        this.callback = callback;
        this.timeInterval = timeInterval;
    }

    start(): void {
        this.expected = Date.now() + this.timeInterval;
        this.timeout = setTimeout(() => this.round(), this.timeInterval);
    }

    stop(): void {
        if (this.timeout) {
        clearTimeout(this.timeout);
        }
    }

    private round(): void {
        const drift = Date.now() - this.expected;
        this.callback();
        this.expected += this.timeInterval;
        this.timeout = setTimeout(() => this.round(), this.timeInterval - drift);
    }
}