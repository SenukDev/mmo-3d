use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;

use hecs::World;
use log::info;

use crate::components::*;
use crate::systems::*;
use crate::render::*;

#[wasm_bindgen]
pub struct ECS {
    world: World,
}

#[wasm_bindgen]
impl ECS {
    #[wasm_bindgen(constructor)]
    pub fn new() -> Result<ECS, JsValue> {
        let mut world = World::new();

        world.spawn((Tick { tick: 0 },));

        let mut starting_x: f32 = 0.0;
        let mut starting_z: f32 = 0.0;

        world.spawn((
            Local,
            Player {state: PlayerState::Idle},
            Render {model: ModelId::Test, dirty: true},
            Position { x: starting_x, z: starting_z },
            Rotation { x: 0.0, y: 45.0},
            Velocity { x: starting_x, z: starting_z },
            PlayerMove {speed: 2.0, target_x: starting_x, target_z: starting_z},
            PlayerCollision { radius: 16.0, offset_x: 0.0, offset_z: 0.0 },
        ));

        starting_x = 3.0;
        starting_z = 0.0;

        world.spawn((
            Local,
            Player {state: PlayerState::Idle},
            Render {model: ModelId::Test, dirty: true},
            Position { x: starting_x, z: starting_z },
            Rotation { x: 0.0, y: 45.0},
            Velocity { x: starting_x, z: starting_z },
            PlayerMove {speed: 2.0, target_x: starting_x, target_z: starting_z},
            PlayerCollision { radius: 16.0, offset_x: 0.0, offset_z: 0.0 },
        ));

        starting_x = -3.0;
        starting_z = 0.0;

        world.spawn((
            Local,
            Player {state: PlayerState::Idle},
            Render {model: ModelId::Test, dirty: true},
            Position { x: starting_x, z: starting_z },
            Rotation { x: 0.0, y: 45.0},
            Velocity { x: starting_x, z: starting_z },
            PlayerMove {speed: 2.0, target_x: starting_x, target_z: starting_z},
            PlayerCollision { radius: 16.0, offset_x: 0.0, offset_z: 0.0 },
        ));

        world.spawn((
            Collision {
                collision_lines: vec![
                    CollisionLine { x1: 384.0, y1: 256.0, x2: 640.0, y2: 256.0 },
                ]
            },
        ));

        Ok(ECS { world })
    }

    pub fn update(&mut self) -> Result<JsValue, JsValue> {
        update_tick(&mut self.world);
        update_state(&mut self.world);
        player_state(&mut self.world);
        apply_velocity(&mut self.world);

        let render_packet: Vec<RenderItem> = build_render(&mut self.world);
        let js = serde_wasm_bindgen::to_value(&render_packet)?;
        Ok(js)
    }
}