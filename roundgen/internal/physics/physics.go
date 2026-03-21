// Package physics implements a 60 Hz 2-D pool ball simulator.
// The constants mirror the frontend AnimationController so the two
// environments agree on ball travel distances and timing.
package physics

import (
	"math"
	"math/rand"

	"github.com/pool-break-bit/roundgen/internal/model"
)

// ── Physics constants (must match AnimationController.ts) ────────────────────

const (
	dt              = 1.0 / 60.0 // seconds per frame
	rollingRetain   = 0.58       // speed fraction surviving 1 s of felt friction
	                             // (raised from 0.38 → balls travel farther, more pocket variety)
	winnerRetain    = rollingRetain
	railRetention   = 0.72 // energy kept after cushion bounce (raised from 0.65)
	ballRestitution = 0.87 // coefficient of restitution, ball-ball
	stopSpeed       = 5.0  // px/s threshold — ball halts completely below this
)

// sampleEvery records one snapshot every N physics frames (~33 ms at 60 Hz).
const sampleEvery = 2

// maxFrames caps the simulation at 10 s to prevent infinite loops.
const maxFrames = 600

// ── Cue-ball launch parameters ────────────────────────────────────────────────

const (
	// cueBallBaseY is the base Y for cue-ball spawn (68 % from felt top).
	cueBallBaseY = model.FeltTop + (model.FeltBottom-model.FeltTop)*0.68

	// launchSpeed in px/s — realistic break shot energy.
	launchSpeed = 900.0

	// breakTargetJitter is the maximum ±px of random noise added to the
	// selected break-target preset, in both X and Y.
	breakTargetJitter = 2.5
)

// ── RNG helpers ───────────────────────────────────────────────────────────────

type rng struct{ r *rand.Rand }

func newRNG(seed int64) rng { return rng{rand.New(rand.NewSource(seed))} }

func (g rng) float() float64 { return g.r.Float64() }

// rangeF returns a float in [lo, hi).
func (g rng) rangeF(lo, hi float64) float64 { return lo + g.float()*(hi-lo) }

// ── Simulation ────────────────────────────────────────────────────────────────

// Simulate runs the physics for one break shot and returns the complete Round record.
func Simulate(seed int64, ballConfig [15]int) model.Round {
	rng := newRNG(seed)

	// ── Initial positions ──────────────────────────────────────────────────────
	balls := make([]model.Ball, 16) // index 0=cue, 1–15=object balls

	// ── Cue ball spawn ────────────────────────────────────────────────────────
	// X spans the middle 50 % of the felt (25 %–75 %) for realistic head-string placement.
	// Y varies ±20 px around the base position for additional shot-angle diversity.
	cueX := rng.rangeF(
		model.FeltLeft+(model.FeltRight-model.FeltLeft)*0.25,
		model.FeltLeft+(model.FeltRight-model.FeltLeft)*0.75,
	)
	cueY := rng.rangeF(cueBallBaseY-20, cueBallBaseY+20)

	balls[0] = model.Ball{ID: 0, X: cueX, Y: cueY, PocketID: -1}

	// Object balls — rack positions, IDs from ballConfig.
	for slot := 0; slot < 15; slot++ {
		x, y := model.RackSlot(slot)
		balls[slot+1] = model.Ball{
			ID:       ballConfig[slot],
			X:        x,
			Y:        y,
			PocketID: -1,
		}
	}

	// ── Break target selection ────────────────────────────────────────────────
	// Choose one of 7 physically realistic rack-impact presets, then add a
	// small deterministic jitter so even rounds with the same preset differ.
	presetIdx := rng.r.Intn(len(model.BreakPresets))
	preset := model.BreakPresets[presetIdx]
	targetX := preset.X + rng.rangeF(-breakTargetJitter, breakTargetJitter)
	targetY := preset.Y + rng.rangeF(-breakTargetJitter, breakTargetJitter)

	// Compute normalised strike direction from cue spawn → break target.
	aimDX := targetX - cueX
	aimDY := targetY - cueY
	aimLen := math.Sqrt(aimDX*aimDX + aimDY*aimDY)
	aimDX /= aimLen
	aimDY /= aimLen

	balls[0].VX = aimDX * launchSpeed
	balls[0].VY = aimDY * launchSpeed

	// Per-ball friction retain value.
	retain := make([]float64, 16)
	for i := range retain {
		retain[i] = rollingRetain
	}

	// ── Simulation loop ────────────────────────────────────────────────────────
	var (
		samples      []model.Sample
		pocketEvents []model.PocketEvent
		frame        int
	)

	for frame = 0; frame < maxFrames; frame++ {
		tMs := int(math.Round(float64(frame) * dt * 1000))

		// ── Integrate positions ───────────────────────────────────────────────
		for i := range balls {
			b := &balls[i]
			if b.Pocketed {
				continue
			}
			b.X += b.VX * dt
			b.Y += b.VY * dt
		}

		// ── Ball-ball collisions (3 passes for tightly-packed rack) ─────────
		resolveCollisions(balls)
		resolveCollisions(balls)
		resolveCollisions(balls)

		// ── Rails, friction, stop, pocket capture ────────────────────────────
		R := model.BallRadius
		for i := range balls {
			b := &balls[i]
			if b.Pocketed {
				continue
			}

			// Cushion bounce.
			if b.X < model.FeltLeft+R {
				b.X = model.FeltLeft + R
				b.VX = math.Abs(b.VX) * railRetention
			} else if b.X > model.FeltRight-R {
				b.X = model.FeltRight - R
				b.VX = -math.Abs(b.VX) * railRetention
			}
			if b.Y < model.FeltTop+R {
				b.Y = model.FeltTop + R
				b.VY = math.Abs(b.VY) * railRetention
			} else if b.Y > model.FeltBottom-R {
				b.Y = model.FeltBottom - R
				b.VY = -math.Abs(b.VY) * railRetention
			}

			// Rolling friction.
			f := math.Pow(retain[i], dt)
			b.VX *= f
			b.VY *= f

			// Threshold stop.
			if b.VX*b.VX+b.VY*b.VY < stopSpeed*stopSpeed {
				b.VX = 0
				b.VY = 0
			}

			// Pocket capture.
			for _, p := range model.Pockets {
				dx := p.X - b.X
				dy := p.Y - b.Y
				if dx*dx+dy*dy < model.PocketRadius*model.PocketRadius {
					b.Pocketed = true
					b.PocketID = p.ID
					b.VX = 0
					b.VY = 0
					pocketEvents = append(pocketEvents, model.PocketEvent{
						TMs:      tMs,
						BallID:   b.ID,
						PocketID: p.ID,
					})
					break
				}
			}
		}

		// ── Record sample every sampleEvery frames ────────────────────────────
		if frame%sampleEvery == 0 {
			s := make(model.Sample, model.SampleStride)
			s[0] = float64(tMs)
			// cue ball at indices 1,2
			s[1] = balls[0].X
			s[2] = balls[0].Y
			// object balls at 3+2*slot, 4+2*slot
			for slot := 0; slot < 15; slot++ {
				idx := 3 + slot*2
				b := &balls[slot+1]
				if b.Pocketed {
					s[idx] = 0
					s[idx+1] = 0
				} else {
					s[idx] = b.X
					s[idx+1] = b.Y
				}
			}
			samples = append(samples, s)
		}

		// ── Early exit: all balls stopped or pocketed ─────────────────────────
		if allStopped(balls) {
			break
		}
	}

	// ── Determine first pocketed outcome ─────────────────────────────────────
	// -1 = nothing pocketed, 0 = cue only, 1-15 = first object ball pocketed.
	firstBallID := -1
	firstPocketID := -1
	cuePocketed := false
	for _, pe := range pocketEvents {
		if pe.BallID == 0 {
			cuePocketed = true
		} else if firstBallID == -1 {
			firstBallID = pe.BallID
			firstPocketID = pe.PocketID
		}
	}
	// If no object ball was pocketed but the cue was, report outcome 0.
	if firstBallID == -1 && cuePocketed {
		firstBallID = 0
	}

	return model.Round{
		BallConfig:            ballConfig,
		CueBallSpawnX:         cueX,
		CueBallSpawnY:         cueY,
		BreakTargetPresetID:   preset.ID,
		BreakTargetX:          targetX,
		BreakTargetY:          targetY,
		Samples:               samples,
		PocketEvents:          pocketEvents,
		FirstPocketedBallID:   firstBallID,
		FirstPocketedPocketID: firstPocketID,
		Seed:                  seed,
	}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func resolveCollisions(balls []model.Ball) {
	minDist := model.BallRadius * 2
	minDistSq := minDist * minDist

	for ai := range balls {
		sa := &balls[ai]
		if sa.Pocketed {
			continue
		}
		for bi := ai + 1; bi < len(balls); bi++ {
			sb := &balls[bi]
			if sb.Pocketed {
				continue
			}
			dx := sb.X - sa.X
			dy := sb.Y - sa.Y
			distSq := dx*dx + dy*dy
			if distSq >= minDistSq || distSq < 0.0001 {
				continue
			}
			dist := math.Sqrt(distSq)
			nx := dx / dist
			ny := dy / dist

			push := (minDist - dist) * 0.5
			sa.X -= nx * push
			sa.Y -= ny * push
			sb.X += nx * push
			sb.Y += ny * push

			rvn := (sa.VX-sb.VX)*nx + (sa.VY-sb.VY)*ny
			if rvn <= 0 {
				continue
			}
			j := (1 + ballRestitution) * rvn / 2
			sa.VX -= j * nx
			sa.VY -= j * ny
			sb.VX += j * nx
			sb.VY += j * ny
		}
	}
}

func allStopped(balls []model.Ball) bool {
	for i := range balls {
		b := &balls[i]
		if !b.Pocketed && (b.VX != 0 || b.VY != 0) {
			return false
		}
	}
	return true
}
