export class Particle {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.frac = 0.2;
        this.stableFrames = 0;
    }
    preUpdate(part) {
        const xDist = this.x - part.x;
        const yDist = this.y - part.y;
        this.x -= xDist * this.frac;
        this.y -= yDist * this.frac;
        this.stableFrames += 1;
        if (this.stableFrames > 100) {
            this.stableFrames = 100;
        }
    }
    draw(ctx) {
        const circle = new Path2D();
        circle.arc(this.x, this.y, 5, 0, 2 * Math.PI);
        const alpha = this.stableFrames / 100;
        ctx.fillStyle = `hsla(300, 100%, 50%, ${alpha})`;
        ctx.fill(circle);
    }
    postUpdate() {
        this.stableFrames -= 0.5;
        if (this.stableFrames < 0) {
            this.stableFrames = 0;
        }
    }
}
