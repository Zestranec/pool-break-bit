// Package stats collects distribution statistics across a generated dataset
// so you can verify the dataset covers all 16 outcome buckets adequately.
package stats

import "fmt"

// OutcomeCount accumulates per-outcome counts.
// Bucket 0  = cue ball only pocketed (no object ball).
// Bucket 1–15 = first object ball pocketed was ball N.
// Bucket -1  = no ball pocketed at all (these are filtered out by quality).
type OutcomeCount struct {
	counts [17]int // index 0=cue/none, 1–15=ball ID, 16=truly_none (should be 0 after filter)
	total  int
}

// Record adds one round to the statistics.
// firstBall: -1 = nothing pocketed, 0 = cue only, 1–15 = object ball ID.
func (oc *OutcomeCount) Record(firstBall int) {
	oc.total++
	switch {
	case firstBall >= 1 && firstBall <= 15:
		oc.counts[firstBall]++
	case firstBall == 0:
		oc.counts[0]++
	default:
		oc.counts[16]++ // should not happen after quality filter
	}
}

// Print prints a summary table to stdout.
func (oc *OutcomeCount) Print() {
	fmt.Printf("Total rounds: %d\n", oc.total)
	fmt.Printf("  Cue only (ball 0): %d (%.1f%%)\n",
		oc.counts[0], pct(oc.counts[0], oc.total))
	for b := 1; b <= 15; b++ {
		fmt.Printf("  Ball %2d: %4d (%.1f%%)\n",
			b, oc.counts[b], pct(oc.counts[b], oc.total))
	}
	if oc.counts[16] > 0 {
		fmt.Printf("  [warn] none/other: %d\n", oc.counts[16])
	}
}

func pct(n, total int) float64 {
	if total == 0 {
		return 0
	}
	return float64(n) * 100 / float64(total)
}
