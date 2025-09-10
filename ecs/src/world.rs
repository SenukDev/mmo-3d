use wasm_bindgen::prelude::*;

use hecs::World;
//use log::info;

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

        let starting_x: f32 = 0.0;
        let starting_z: f32 = 0.0;

        world.spawn((
            Local,
            Player {state: PlayerState::Idle},
            Render {model: ModelId::Player, animation_index: 0, dirty: true},
            Position { x: starting_x, z: starting_z },
            Rotation { y: 0.0 },
            Velocity { x: starting_x, z: starting_z },
            PlayerMove {speed: 0.2, target_x: starting_x, target_z: starting_z},
            PlayerNode {node_selected: false, node_entity_id: "".to_string()},
            PlayerCollision { radius: 16.0, offset_x: 0.0, offset_z: 0.0 },
        ));

        world.spawn((
            Render {model: ModelId::Rock, animation_index: -1, dirty: true},
            Position { x: 5.0, z: 0.0 },
            Rotation { y: 0.0 },
        ));

        world.spawn((
            Render {model: ModelId::Rock, animation_index: -1, dirty: true},
            Position { x: -5.0, z: 0.0 },
            Rotation { y: 0.0 },
        ));

        world.spawn((
            Render {model: ModelId::Rock, animation_index: -1, dirty: true},
            Position { x: 2.0, z: 10.0 },
            Rotation { y: 0.0 },
        ));


        Ok(ECS { world })
    }

    pub fn update(&mut self) -> Result<JsValue, JsValue> {
        update_tick(&mut self.world);
        update_state(&mut self.world);
        player_state(&mut self.world);
        apply_velocity(&mut self.world);

        let render_packet: Vec<RenderItem> = build_render_packet(&mut self.world);
        let js = serde_wasm_bindgen::to_value(&render_packet)?;
        Ok(js)
    }

    pub fn input_move(&mut self, x: f32, z: f32) {
        for (_, (_,
            _,
            player_move,
            player_node,
        )) in self.world.query::<(
            &Local,
            &Player,
            &mut PlayerMove,
            &mut PlayerNode,
        )>().iter() {
            player_node.node_selected = false;
            player_move.target_x = x;
            player_move.target_z = z;
        }
    }

    pub fn input_node(&mut self, entity_id: String) {
        for (_, (_,
            _,
            player_node,
        )) in self.world.query::<(
            &Local,
            &Player,
            &mut PlayerNode
        )>().iter() {
            player_node.node_selected = true;
            player_node.node_entity_id = entity_id.clone();
        }
    }
}