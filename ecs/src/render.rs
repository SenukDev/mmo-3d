use hecs::World;
use crate::components::*;

pub fn build_render_packet(world: &mut World) -> Vec<RenderItem> {
    let mut render_packet: Vec<RenderItem> = Vec::new();

    for (entity,(
        render,
        position,
        rotation,
    )) in world.query::<(
        &mut Render,
        &Position,
        &Rotation,
    )>().iter() {
        if render.dirty == true {
            let id_str = entity.to_bits().to_string();

            render_packet.push(RenderItem {
                entity_id: id_str,
                model: render.model,
                position_x: position.x,
                position_z: position.z,
                rotation_y: rotation.y,
            });
            render.dirty = false;
        }
    }

    return render_packet;
}