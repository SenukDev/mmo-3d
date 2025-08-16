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
pub struct Velocity {
    pub x: f32,
    pub z: f32,
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

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PlayerState {
    Idle,
    Move,
}