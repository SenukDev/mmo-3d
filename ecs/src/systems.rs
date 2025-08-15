use crate::components::*;
//use crate::scripts::*;
use hecs::World;

pub fn update_tick(world: &mut World) {
    for (_, tick) in world.query_mut::<&mut Tick>() {
        tick.tick += 1;
    }
}