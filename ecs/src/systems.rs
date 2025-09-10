use hecs::{World, Entity};
use crate::components::*;
use crate::scripts::*;
//use log::info;

pub fn update_tick(world: &mut World) {
    for (_, tick) in world.query_mut::<&mut Tick>() {
        tick.tick += 1;
    }
}

pub fn update_state(world: &mut World) {
    for (_,(
        _,
        player,
        position,
        player_move,
        player_node,
    )) in world.query::<(
        &Local,
        &mut Player,
        &Position,
        &mut PlayerMove,
        &PlayerNode,
    )>().iter() {
        if player_node.node_selected == true {
            let bits = player_node.node_entity_id.parse::<u64>();
            let entity = Entity::from_bits(bits.unwrap());
            if let Ok(node_target_position) = world.get::<&Position>(entity.unwrap()) {
                let dx = node_target_position.x - position.x;
                let dz = node_target_position.z - position.z;
                let node_target_distance = (dx * dx + dz * dz).sqrt();
                    
                if node_target_distance > 3.0 {
                    player_move.target_x = node_target_position.x;
                    player_move.target_z = node_target_position.z;
                    player.state = PlayerState::Move;
                }
                else {
                    player.state = PlayerState::Interact;
                }
            }
        }
        else {
            let dx = player_move.target_x - position.x;
            let dz = player_move.target_z - position.z;
            let move_target_distance = (dx * dx + dz * dz).sqrt();
            
            if move_target_distance > 0.0 {
                player.state = PlayerState::Move;
            }
            else {
                player.state = PlayerState::Idle;
            }
        }
    }
}

pub fn player_state(world: &mut World) {
    for (_,(
        _,
        player,
        position,
        velocity,
        player_move,
        player_collision,
        render,
    )) in world.query::<(
        &Local,
        &mut Player,
        &Position,
        &mut Velocity,
        &mut PlayerMove,
        &PlayerCollision,
        &mut Render,
    )>().iter() {
        match player.state {
            PlayerState::Idle => {
                if render.animation_index != 0 {
                    render.animation_index = 0;
                    render.dirty = true;
                }

                player_move.target_x = position.x;
                player_move.target_z = position.z;
                velocity.x = 0.0;
                velocity.z = 0.0;
            },
            PlayerState::Move => {
                if render.animation_index != 1 {
                    render.animation_index = 1;
                    render.dirty = true;
                }

                let dx = player_move.target_x - position.x;
                let dz = player_move.target_z - position.z;
                let length = (dx * dx + dz * dz).sqrt();

                if length > player_move.speed {
                    velocity.x = dx / length * player_move.speed;
                    velocity.z = dz / length * player_move.speed;
                } else {
                    velocity.x = dx;
                    velocity.z = dz;
                }
                
                for (_, collision) in world.query::<&Collision>().iter() {
                    let (vx, vz) = collision_slide_velocity(&position, &velocity, &player_collision, &collision, 4);
                    velocity.x = vx;
                    velocity.z = vz;
                }

                if velocity.x == 0.0 && velocity.z == 0.0 {
                    player_move.target_x = position.x;
                    player_move.target_z = position.z;
                }
            }
            PlayerState::Interact => {
                if render.animation_index != 2 {
                    render.animation_index = 2;
                    render.dirty = true;
                }

                player_move.target_x = position.x;
                player_move.target_z = position.z;
                velocity.x = 0.0;
                velocity.z = 0.0;
            }
        }
    }
}

pub fn apply_velocity(world: &mut World) {
    for (_,(
        _,
        position,
        velocity,
        rotation,
        render
    )) in world.query::<(
        &Player,
        &mut Position,
        &Velocity,
        &mut Rotation,
        &mut Render
    )>().iter() {
        position.x += velocity.x;
        position.z += velocity.z;
        
        if velocity.x != 0.0 || velocity.z != 0.0 {
            rotation.y = velocity.x.atan2(velocity.z);
            render.dirty = true;
        }
    }
}