import Stats from 'stats.js';

import init, { ECS } from "../pkg/ecs"
import { Timer } from './Timer';
import { Renderer } from './Renderer';

async function run() {
    const fps = 30;

    const stats = new Stats()
    document.body.appendChild(stats.dom)

    await init();

    //Create ECS
    let ecs;
    try {
        ecs = new ECS();
    } catch (err) {
        console.error("Failed to create ECS:", err);
        return;
    }

    const renderer = new Renderer();
    await renderer.init();

    const timer = new Timer(() => {
        try {
            let render_packet = ecs.update();
            renderer.render(render_packet);
            stats.update();
        } catch (err) {
            console.error("Error in ecs.update():", err);
        }
    }, 1000 / fps);

    timer.start();
}

run();