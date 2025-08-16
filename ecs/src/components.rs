use serde::Serialize;

#[derive(Debug)]
pub struct Tick {
    pub tick: u64,
}

#[derive(Debug)]
pub struct Local;

#[derive(Debug)]
pub struct Player {
    pub state: PlayerState,
}


#[derive(Debug)]
pub struct Position {
    pub x: f32,
    pub z: f32,
}

#[derive(Debug)]
pub struct Rotation {
    pub x: f32,
    pub y: f32,
}

#[derive(Debug)]
pub struct Velocity {
    pub x: f32,
    pub z: f32,
}

#[derive(Debug)]
pub struct Render {
    pub dirty: bool,
    pub model: ModelId,
}

#[derive(Debug)]
pub struct PlayerCollision {
    pub radius: f32,
    pub offset_x: f32,
    pub offset_z: f32,
}

#[derive(Debug)]
pub struct PlayerMove {
    pub speed: f32,
    pub target_x: f32,
    pub target_z: f32,
}

#[derive(Debug)]
pub struct Collision {
    pub collision_lines: Vec<CollisionLine>, 
}

#[derive(Debug)]
pub struct CollisionLine {
    pub x1: f32,
    pub y1: f32,
    pub x2: f32,
    pub y2: f32,
}

#[derive(Serialize)]
pub struct RenderItem {
    pub entity_id: String,
    pub model: ModelId,
    pub position_x: f32,
    pub position_z: f32,
    pub rotation_x: f32,
    pub rotation_y: f32,
}

//Enums
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlayerState {
    Idle,
    Move,
}

#[derive(Debug, Serialize, Clone, Copy)]
#[serde(rename_all = "snake_case")]
pub enum ModelId {
    Test,
}