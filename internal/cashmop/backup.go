package cashmop

import "time"

func (s *Service) CreateBackup(destination string) error {
	return s.store.CreateBackup(destination)
}

func (s *Service) CreateAutoBackup() (string, error) {
	return s.store.CreateAutoBackup()
}

func (s *Service) ValidateBackup(path string) (int64, error) {
	return s.store.ValidateBackup(path)
}

func (s *Service) RestoreBackup(path string) error {
	return s.store.RestoreBackup(path)
}

func (s *Service) RestoreBackupWithSafety(path string) (string, error) {
	return s.store.RestoreBackupWithSafety(path)
}

func (s *Service) EnsureBackupDir() (string, error) {
	return s.store.EnsureBackupDir()
}

func (s *Service) GetLastBackupTime() (time.Time, error) {
	return s.store.GetLastBackupTime()
}

func (s *Service) ShouldAutoBackup() (bool, error) {
	return s.store.ShouldAutoBackup()
}
