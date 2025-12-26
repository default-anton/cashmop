package fuzzy

import (
	"sort"
	"strings"

	"github.com/junegunn/fzf/src/algo"
	"github.com/junegunn/fzf/src/util"
)

// Match ranks a list of items based on a query using fzf algorithm.
// It uses consistent settings (case-insensitive, normalized) for the whole app.
func Match(query string, items []string) []string {
	if query == "" {
		return items
	}

	patternRunes := []rune(strings.ToLower(query))
	slab := util.MakeSlab(100, 2048)

	type scoredItem struct {
		item  string
		score int
	}

	var scored []scoredItem

	for _, item := range items {
		chars := util.ToChars([]byte(strings.ToLower(item)))
		result, _ := algo.FuzzyMatchV2(
			false, // caseSensitive
			true,  // normalize
			true,  // forward
			&chars,
			patternRunes,
			false, // withPos
			slab,
		)

		if result.Score > 0 {
			score := result.Score
			// Boost matches that happen earlier in the string
			// result.Start is 0-based index of the first matched character
			// We give a big bonus for starting at 0
			if result.Start == 0 {
				score += 1000
			} else {
				score += (500 - result.Start)
			}
			scored = append(scored, scoredItem{item: item, score: score})
		}
	}

	sort.Slice(scored, func(i, j int) bool {
		if scored[i].score != scored[j].score {
			return scored[i].score > scored[j].score
		}
		// Tie-break: shorter strings first
		if len(scored[i].item) != len(scored[j].item) {
			return len(scored[i].item) < len(scored[j].item)
		}
		return strings.ToLower(scored[i].item) < strings.ToLower(scored[j].item)
	})

	res := make([]string, 0, len(scored))
	for _, si := range scored {
		res = append(res, si.item)
	}
	return res
}
