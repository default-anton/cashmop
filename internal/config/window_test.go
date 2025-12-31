package config

import (
	"testing"
)

func TestIsWindowStateValid(t *testing.T) {
	tests := []struct {
		name  string
		state WindowState
		want  bool
	}{
		{
			name:  "default state is valid",
			state: defaultState(),
			want:  true,
		},
		{
			name: "valid position and size",
			state: WindowState{
				X:      100,
				Y:      100,
				Width:  1024,
				Height: 768,
			},
			want: true,
		},
		{
			name: "negative X is invalid",
			state: WindowState{
				X:      -50000,
				Y:      100,
				Width:  1024,
				Height: 768,
			},
			want: false,
		},
		{
			name: "negative Y is invalid",
			state: WindowState{
				X:      100,
				Y:      -50000,
				Width:  1024,
				Height: 768,
			},
			want: false,
		},
		{
			name: "negative width is invalid",
			state: WindowState{
				X:      100,
				Y:      100,
				Width:  -1,
				Height: 768,
			},
			want: false,
		},
		{
			name: "width too small",
			state: WindowState{
				X:      100,
				Y:      100,
				Width:  50,
				Height: 768,
			},
			want: false,
		},
		{
			name: "height too small",
			state: WindowState{
				X:      100,
				Y:      100,
				Width:  1024,
				Height: 50,
			},
			want: false,
		},
		{
			name: "width too large",
			state: WindowState{
				X:      100,
				Y:      100,
				Width:  20000,
				Height: 768,
			},
			want: false,
		},
		{
			name: "height too large",
			state: WindowState{
				X:      100,
				Y:      100,
				Width:  1024,
				Height: 20000,
			},
			want: false,
		},
		{
			name:  "zero position is valid",
			state: WindowState{X: 0, Y: 0, Width: 1024, Height: 768},
			want:  true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := IsWindowStateValid(tt.state); got != tt.want {
				t.Errorf("IsWindowStateValid() = %v, want %v", got, tt.want)
			}
		})
	}
}
