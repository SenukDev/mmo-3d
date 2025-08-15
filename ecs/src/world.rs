use wasm_bindgen::prelude::*;
use wasm_bindgen::JsCast;

use hecs::World;
use log::info;

use crate::components::*;
use crate::systems::*;
//use crate::render::*;

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

        Ok(ECS { world })
    }

    pub fn update(&mut self) -> Result<(), JsValue> {
        update_tick(&mut self.world);
        Ok(())
    }
}
