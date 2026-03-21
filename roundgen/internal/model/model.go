// Package model defines the shared data types for the pool physics simulator
// and the replay export format consumed by the frontend.
package model

// ── Table geometry (mirrors src/game/config/gameConfig.ts) ───────────────────

const (
	TableWidth   = 400.0
	TableHeight  = 500.0
	BorderWidth  = 24.0
	BallRadius   = 11.0
	PocketRadius = 19.0

	FeltLeft   = BorderWidth
	FeltRight  = TableWidth - BorderWidth
	FeltTop    = BorderWidth
	FeltBottom = TableHeight - BorderWidth
)

// Pocket holds the centre position and id of one of the six pockets.
// Layout (portrait orientation, long axis vertical):
//
//	0=TL  2=TR
//	1=LM  4=RM   ← mid pockets on long rails
//	3=BL  5=BR
type Pocket struct {
	ID int
	X  float64
	Y  float64
}

var Pockets = [6]Pocket{
	{0, FeltLeft, FeltTop},            // TL
	{1, FeltLeft, TableHeight / 2},    // LM
	{2, FeltRight, FeltTop},           // TR
	{3, FeltLeft, FeltBottom},         // BL
	{4, FeltRight, TableHeight / 2},   // RM
	{5, FeltRight, FeltBottom},        // BR
}

// ── Rack geometry (mirrors RACK_POSITIONS) ────────────────────────────────────
// Standard 8-ball triangle, 5 rows, apex nearest the cue ball (high Y).

const (
	RCX = TableWidth / 2 // 200
	RCY = 130.0          // rack centre Y (foot spot)
	HS  = 22.0           // horizontal spacing = 2 × BallRadius
	VS  = 19.0           // vertical spacing ≈ HS × sin60°
)

// RackSlot returns the (x,y) centre of rack slot i (0=apex … 14=back-right).
func RackSlot(i int) (float64, float64) {
	switch i {
	case 0:
		return RCX, RCY + VS*2
	case 1:
		return RCX - HS/2, RCY + VS
	case 2:
		return RCX + HS/2, RCY + VS
	case 3:
		return RCX - HS, RCY
	case 4:
		return RCX, RCY
	case 5:
		return RCX + HS, RCY
	case 6:
		return RCX - HS*1.5, RCY - VS
	case 7:
		return RCX - HS/2, RCY - VS
	case 8:
		return RCX + HS/2, RCY - VS
	case 9:
		return RCX + HS*1.5, RCY - VS
	case 10:
		return RCX - HS*2, RCY - VS*2
	case 11:
		return RCX - HS, RCY - VS*2
	case 12:
		return RCX, RCY - VS*2
	case 13:
		return RCX + HS, RCY - VS*2
	case 14:
		return RCX + HS*2, RCY - VS*2
	default:
		return RCX, RCY
	}
}

// ── Ball state ────────────────────────────────────────────────────────────────

// Ball is the mutable physics state of one ball.
type Ball struct {
	ID       int     // 1–15 (object balls) or 0 (cue)
	X, Y     float64
	VX, VY   float64
	Pocketed bool
	PocketID int // -1 if not pocketed
}

// ── Pocket event ─────────────────────────────────────────────────────────────

// PocketEvent records the moment a ball enters a pocket.
type PocketEvent struct {
	TMs     int // simulation time in milliseconds
	BallID  int // 0=cue, 1–15=object balls
	PocketID int
}

// ── Sample ────────────────────────────────────────────────────────────────────

// Sample is one recorded snapshot of the world, taken every SampleInterval frames.
// Layout: [tMs, cueX, cueY, b1X, b1Y, b2X, b2Y, … b15X, b15Y]
// Pocketed balls are recorded as 0,0 (sentinel).
const SampleStride = 33 // 2 fields per ball (15) + cue (2) + time (1) = 33

type Sample []float64 // length SampleStride

// ── Break target presets ──────────────────────────────────────────────────────

// BreakPreset is one named, physically realistic rack-impact point.
// All coordinates are in the same space as RackSlot() output.
//
// The seven presets span the realistic break-shot range:
//   from a full left-cluster hit (slot 1 direct) through center-apex
//   to a full right-cluster hit (slot 2 direct).
//
// Rack reference points (portrait orientation, apex nearest cue / high Y):
//   Apex  (slot 0): (200, 168)
//   Slot1 (slot 1): (189, 149)   left-front
//   Slot2 (slot 2): (211, 149)   right-front
type BreakPreset struct {
	ID   int
	Name string
	X    float64 // table-space target X
	Y    float64 // table-space target Y
}

// BreakPresets lists all legal break-target presets in order of ID.
var BreakPresets = [7]BreakPreset{
	{0, "apex-center",   200.0, 168.0}, // dead center on apex ball
	{1, "apex-left",     196.5, 168.0}, // ~quarter-ball left of apex center
	{2, "apex-right",    203.5, 168.0}, // ~quarter-ball right of apex center
	{3, "seam-left",     193.0, 164.0}, // left edge of apex ball (half-ball contact)
	{4, "seam-right",    207.0, 164.0}, // right edge of apex ball (half-ball contact)
	{5, "deep-left",     191.0, 161.0}, // deep left contact: more energy to right side
	{6, "deep-right",    209.0, 161.0}, // deep right contact: more energy to left side
}

// ── Round record ─────────────────────────────────────────────────────────────

// Round is the complete record of one simulated break, ready for export.
type Round struct {
	// BallConfig maps rack slot → ball ID (1–15).
	// Slot 0 = apex; the frontend uses this to know which physical ball is in each slot.
	BallConfig [15]int

	// CueBallSpawnX/Y is where the cue ball starts.
	CueBallSpawnX float64
	CueBallSpawnY float64

	// BreakTargetPresetID identifies which BreakPreset was chosen.
	BreakTargetPresetID int
	// BreakTargetX/Y is the actual aim point (preset + jitter).
	BreakTargetX float64
	BreakTargetY float64

	// Samples holds the position snapshots (every 2 physics frames ≈ 33 ms).
	Samples []Sample

	// PocketEvents records every ball-pocket event in simulation order.
	PocketEvents []PocketEvent

	// FirstPocketedBallID is the ball ID of the first object ball pocketed
	// (0 if only the cue was pocketed first, -1 if nothing pocketed).
	FirstPocketedBallID int

	// FirstPocketedPocketID is the pocket the first ball fell into (-1 if none).
	FirstPocketedPocketID int

	// Seed used to generate this round (for reproducibility).
	Seed int64
}
