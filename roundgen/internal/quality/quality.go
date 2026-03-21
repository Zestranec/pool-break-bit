// Package quality filters out rounds that would look bad when replayed.
package quality

import (
	"github.com/pool-break-bit/roundgen/internal/model"
)

// minFirstPocketMs: first pocket must occur at least 1.0 s into the animation.
const minFirstPocketMs = 1000

// maxFirstPocketMs: first pocket must occur within 4.0 s.
const maxFirstPocketMs = 4000

// minBallsMovedFar: at least this many balls must travel > 40 px from their
// starting position, ensuring the break looks impactful.
const minBallsMovedFar = 5

// Check returns true if the round is visually acceptable for replay.
func Check(r model.Round) bool {
	// Must have at least one pocket event (cue or ball).
	if len(r.PocketEvents) == 0 {
		return false
	}

	// FirstPocketedBallID == -1 means nothing pocketed at all; reject.
	if r.FirstPocketedBallID < 0 {
		return false
	}

	// FirstPocketedBallID == 0 → cue-ball-first round (outcome "zero").
	// These are valid; the time window check below covers all first-pocket events.

	// First pocket must fall in the acceptable time window (applies to both
	// cue-first and object-ball-first rounds).
	firstPocket := r.PocketEvents[0]
	if firstPocket.TMs < minFirstPocketMs || firstPocket.TMs > maxFirstPocketMs {
		return false
	}

	// Enough balls must have scattered meaningfully.
	// We derive starting positions from the first sample and compare to the
	// last sample where the ball was non-zero.
	if len(r.Samples) < 2 {
		return false
	}
	first := r.Samples[0]
	last := r.Samples[len(r.Samples)-1]

	movedFar := 0
	for slot := 0; slot < 15; slot++ {
		idx := 3 + slot*2
		x0, y0 := first[idx], first[idx+1]
		xN, yN := last[idx], last[idx+1]
		// Skip if pocketed in the last sample (0,0 sentinel).
		if xN == 0 && yN == 0 {
			movedFar++ // pocketed balls definitely moved far
			continue
		}
		dx, dy := xN-x0, yN-y0
		if dx*dx+dy*dy > 40*40 {
			movedFar++
		}
	}
	if movedFar < minBallsMovedFar {
		return false
	}

	return true
}
