// roundgen — pool break replay dataset generator
//
// Usage:
//
//	roundgen -n 100 -out public/data       # generate 100 quality rounds
//	roundgen -n 1 -seed 42 -stdout         # single round to stdout (debug)
//	roundgen -n 500 -out public/data -stats # print distribution stats afterward
package main

import (
	"flag"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"

	"github.com/pool-break-bit/roundgen/internal/export"
	"github.com/pool-break-bit/roundgen/internal/physics"
	"github.com/pool-break-bit/roundgen/internal/quality"
	"github.com/pool-break-bit/roundgen/internal/stats"
)

// maxPatternCount: maximum times the same (firstBall, firstPocket) pair
// may appear in the accepted dataset.  Rounds exceeding this limit are
// rejected so no single ball→pocket pattern dominates the replay library.
const maxPatternCount = 5

// maxCueFirst: maximum cue-first (outcome 0) rounds accepted.
// Cue-first rounds have firstPock=-1 so they bypass the pattern filter;
// this separate cap prevents them from overwhelming the dataset.
const maxCueFirst = 12

func main() {
	n := flag.Int("n", 100, "number of quality rounds to produce")
	outDir := flag.String("out", "public/data", "output directory for round files and index.json")
	seed := flag.Int64("seed", 0, "base seed (0 = random)")
	stdout := flag.Bool("stdout", false, "write a single round to stdout instead of files")
	showStats := flag.Bool("stats", false, "print distribution statistics after generation")
	maxAttempts := flag.Int("attempts", 30, "max simulation attempts per accepted round")
	flag.Parse()

	baseSeed := *seed
	if baseSeed == 0 {
		baseSeed = rand.Int63()
	}

	// ── Single-round debug mode ───────────────────────────────────────────────
	if *stdout {
		bc := defaultBallConfig()
		r := physics.Simulate(baseSeed, bc)
		if err := export.WriteRoundJSON(os.Stdout, r); err != nil {
			fmt.Fprintf(os.Stderr, "write: %v\n", err)
			os.Exit(1)
		}
		return
	}

	// ── Batch generation mode ─────────────────────────────────────────────────
	var (
		entries  []export.IndexEntry
		sc       stats.DatasetStats
		attempt  int64
		accepted int
	)

	// patternCount tracks how many accepted rounds have the same
	// (firstBall, firstPocket) outcome pair, to enforce diversity.
	type patternKey struct{ ball, pocket int }
	patternCount := make(map[patternKey]int)
	cueFirstCount := 0

	fmt.Printf("Generating %d quality rounds (seed base %d)…\n", *n, baseSeed)

	for accepted < *n {
		attempt++
		if attempt > int64(*n)*int64(*maxAttempts) {
			fmt.Fprintf(os.Stderr, "error: could not find %d quality rounds in %d attempts\n",
				*n, attempt-1)
			os.Exit(1)
		}

		bc := shuffleBalls(baseSeed + attempt)
		r := physics.Simulate(baseSeed+attempt, bc)

		if !quality.Check(r) {
			continue
		}

		// ── Diversity filter ──────────────────────────────────────────────────
		// Reject rounds that would push any (ball, pocket) pair above the cap.
		// Only applies once we have enough accepted rounds to judge diversity.
		if r.FirstPocketedBallID == 0 {
			// Cue-first rounds bypass the ball→pocket pattern filter because
			// firstPock is -1. Enforce a separate absolute cap instead.
			if cueFirstCount >= maxCueFirst {
				continue
			}
			cueFirstCount++
		} else if r.FirstPocketedBallID >= 1 && r.FirstPocketedPocketID >= 0 {
			pk := patternKey{r.FirstPocketedBallID, r.FirstPocketedPocketID}
			if accepted >= *n/4 && patternCount[pk] >= maxPatternCount {
				continue
			}
			patternCount[pk]++
		}

		// Write to rounds/ subdirectory.
		fileName := fmt.Sprintf("round_%05d.json", accepted)
		path := filepath.Join(*outDir, "rounds", fileName)
		if err := export.WriteRoundToFile(path, r); err != nil {
			fmt.Fprintf(os.Stderr, "write %s: %v\n", path, err)
			os.Exit(1)
		}

		entries = append(entries, export.IndexEntry{
			File:          fileName,
			FirstBall:     r.FirstPocketedBallID,
			FirstPock:     r.FirstPocketedPocketID,
			BreakPresetID: r.BreakTargetPresetID,
			CueRegion:     cueRegion(r.CueBallSpawnX),
		})
		sc.Record(r)
		accepted++

		if accepted%50 == 0 || accepted == *n {
			fmt.Printf("  %d/%d accepted (attempt %d)\n", accepted, *n, attempt)
		}
	}

	// Write index.
	idxPath := filepath.Join(*outDir, "index.json")
	if err := export.WriteIndex(idxPath, entries); err != nil {
		fmt.Fprintf(os.Stderr, "write index: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("Wrote %d rounds + index to %s\n", accepted, *outDir)

	if *showStats {
		sc.Print()
	}
}

// defaultBallConfig returns the canonical 1–15 ordering.
func defaultBallConfig() [15]int {
	var bc [15]int
	for i := range bc {
		bc[i] = i + 1
	}
	return bc
}

// cueRegion buckets a cue-ball X position into thirds of the felt:
//
//	0 = left   (FeltLeft … FeltLeft+FeltWidth/3)
//	1 = center (FeltLeft+FeltWidth/3 … FeltLeft+2×FeltWidth/3)
//	2 = right  (FeltLeft+2×FeltWidth/3 … FeltRight)
func cueRegion(x float64) int {
	const (
		feltLeft  = 24.0
		feltRight = 376.0
		third     = (feltRight - feltLeft) / 3.0 // ≈ 117.3
	)
	switch {
	case x < feltLeft+third:
		return 0
	case x < feltLeft+2*third:
		return 1
	default:
		return 2
	}
}

// shuffleBalls returns a seeded Fisher-Yates shuffle of balls 1–15.
func shuffleBalls(seed int64) [15]int {
	bc := defaultBallConfig()
	r := rand.New(rand.NewSource(seed))
	for i := 14; i > 0; i-- {
		j := r.Intn(i + 1)
		bc[i], bc[j] = bc[j], bc[i]
	}
	return bc
}
