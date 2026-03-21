// Package stats collects distribution statistics across a generated dataset.
package stats

import (
	"fmt"

	"github.com/pool-break-bit/roundgen/internal/model"
)

// DatasetStats accumulates statistics over all accepted rounds.
type DatasetStats struct {
	total int

	// outcomeCounts: index 0=cue-first, 1–15=object ball, 16=nothing (should be 0)
	outcomeCounts [17]int

	// presetCounts: how many rounds used each BreakPreset (index = preset.ID)
	presetCounts [7]int

	// ballPocketCounts[ballID][pocketID]: how often firstBall=ballID went to pocketID.
	// ballID 0 = cue-first rounds; ballID 1–15 = object balls.
	ballPocketCounts [16][6]int
}

// Record adds one accepted round to the statistics.
func (s *DatasetStats) Record(r model.Round) {
	s.total++

	fb := r.FirstPocketedBallID
	switch {
	case fb >= 1 && fb <= 15:
		s.outcomeCounts[fb]++
	case fb == 0:
		s.outcomeCounts[0]++
	default:
		s.outcomeCounts[16]++
	}

	if r.BreakTargetPresetID >= 0 && r.BreakTargetPresetID < 7 {
		s.presetCounts[r.BreakTargetPresetID]++
	}

	if fp := r.FirstPocketedPocketID; fb >= 0 && fb <= 15 && fp >= 0 && fp < 6 {
		s.ballPocketCounts[fb][fp]++
	}
}

// OutcomeCount is the legacy alias kept for main.go compatibility.
// Deprecated: use DatasetStats.Record instead.
type OutcomeCount = DatasetStats

// Print prints a full summary table to stdout.
func (s *DatasetStats) Print() {
	fmt.Printf("Total rounds: %d\n", s.total)

	// ── Outcome distribution ─────────────────────────────────────────────────
	fmt.Println("\n── Outcome distribution ─────────────────────────────────")
	fmt.Printf("  Cue only (ball 0): %4d  (%5.1f%%)\n",
		s.outcomeCounts[0], pct(s.outcomeCounts[0], s.total))
	for b := 1; b <= 15; b++ {
		fmt.Printf("  Ball %2d:           %4d  (%5.1f%%)\n",
			b, s.outcomeCounts[b], pct(s.outcomeCounts[b], s.total))
	}
	if s.outcomeCounts[16] > 0 {
		fmt.Printf("  [warn] none/other: %d\n", s.outcomeCounts[16])
	}

	// ── Break-target preset distribution ─────────────────────────────────────
	fmt.Println("\n── Break-target preset distribution ─────────────────────")
	for _, p := range model.BreakPresets {
		n := s.presetCounts[p.ID]
		fmt.Printf("  [%d] %-16s  %4d  (%5.1f%%)\n",
			p.ID, p.Name, n, pct(n, s.total))
	}

	// ── Ball → pocket heatmap (non-zero cells only) ───────────────────────────
	fmt.Println("\n── First-ball → pocket heatmap (ball | TL LM TR BL RM BR) ─")
	pocketNames := [6]string{"TL", "LM", "TR", "BL", "RM", "BR"}
	fmt.Printf("  %6s |", "ball")
	for _, pn := range pocketNames {
		fmt.Printf(" %3s", pn)
	}
	fmt.Println()
	fmt.Printf("  %6s-+", "------")
	for range pocketNames {
		fmt.Printf("----")
	}
	fmt.Println()
	for b := 0; b <= 15; b++ {
		label := fmt.Sprintf("b%d", b)
		if b == 0 {
			label = "cue"
		}
		row := s.ballPocketCounts[b]
		total := 0
		for _, v := range row {
			total += v
		}
		if total == 0 {
			continue
		}
		fmt.Printf("  %6s |", label)
		for _, v := range row {
			if v == 0 {
				fmt.Printf("   .")
			} else {
				fmt.Printf(" %3d", v)
			}
		}
		fmt.Println()
	}

	// ── Diversity warning: flag any (ball, pocket) pair that dominates ────────
	fmt.Println("\n── Diversity warnings (pair appears > 40 % of ball's rounds) ─")
	warned := false
	for b := 0; b <= 15; b++ {
		row := s.ballPocketCounts[b]
		ballTotal := 0
		for _, v := range row {
			ballTotal += v
		}
		if ballTotal < 3 {
			continue
		}
		for p, v := range row {
			if float64(v)/float64(ballTotal) > 0.40 {
				label := fmt.Sprintf("ball %d", b)
				if b == 0 {
					label = "cue"
				}
				fmt.Printf("  [warn] %s → pocket %d (%s): %d/%d = %.0f%%\n",
					label, p, pocketNames[p], v, ballTotal,
					float64(v)/float64(ballTotal)*100)
				warned = true
			}
		}
	}
	if !warned {
		fmt.Println("  None — diversity looks good.")
	}
}

// pct returns n/total as a percentage, safely.
func pct(n, total int) float64 {
	if total == 0 {
		return 0
	}
	return float64(n) * 100 / float64(total)
}
