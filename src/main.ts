import Stats from 'stats.js';

import init, { ECS } from "../pkg/ecs"
import { Timer } from './Timer';
import { Renderer } from './Renderer';

async function run() {
    const fps = 30;

    const stats = new Stats()
    document.body.appendChild(stats.dom)

    document.body.addEventListener("contextmenu", e => e.preventDefault());

    await init();

    let ecs;
    try {
        ecs = new ECS();
    } catch (err) {
        console.error("Failed to create ECS:", err);
        return;
    }

    const renderer = new Renderer();
    await renderer.init();

    document.body.addEventListener("pointerdown", (e) => {
        if (e.button !== 0) return;

        const rect = document.body.getBoundingClientRect();
        const mouse_x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        const mouse_y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

        const result = renderer.inputLeftClick(mouse_x, mouse_y)

        if (result) {
            if (result.outcome == "node" && result.entity_id) {
                ecs.input_node(result.entity_id)
            }
            else if (result.outcome == "move" && result.x && result.z) {
                ecs.input_move(result.x, result.z)
            }
        }
    });


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