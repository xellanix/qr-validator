package lib

import (
	"sync"
)

// KeyedRWMutex dynamically creates and manages RWMutexes based on a string key.
type KeyedRWMutex struct {
	mu    sync.Mutex
	locks map[string]*refCountedRWMutex
}

type refCountedRWMutex struct {
	sync.RWMutex
	refCount int
}

func NewKeyedRWMutex() *KeyedRWMutex {
	return &KeyedRWMutex{
		locks: make(map[string]*refCountedRWMutex),
	}
}

func (m *KeyedRWMutex) _lock(key string) *refCountedRWMutex {
	m.mu.Lock()
	defer m.mu.Unlock()

	// Lazy initialization for zero-value struct support
	if m.locks == nil {
		m.locks = make(map[string]*refCountedRWMutex)
	}

	entry, ok := m.locks[key]
	if !ok {
		entry = &refCountedRWMutex{}
		m.locks[key] = entry
	}
	entry.refCount++

	return entry
}

func (m *KeyedRWMutex) _unlock(entry *refCountedRWMutex, key string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	entry.refCount--
	if entry.refCount == 0 {
		delete(m.locks, key) // Automatically clean up unused locks
	}
}

// Lock acquires an exclusive write lock for a specific key.
// Returns an unlock cleanup function.
func (m *KeyedRWMutex) Lock(key string) func() {
	entry := m._lock(key)
	entry.Lock()

	return func() {
		defer m._unlock(entry, key)
		entry.Unlock()
	}
}

// RLock acquires a shared read lock for a specific key.
// Returns an unlock cleanup function.
func (m *KeyedRWMutex) RLock(key string) func() {
	entry := m._lock(key)
	entry.RLock()

	return func() {
		defer m._unlock(entry, key)
		entry.RUnlock()
	}
}

// DoLock executes a function within a lock for a specific key.
func (m *KeyedRWMutex) DoLock(key string, fn func()) {
	unlock := m.Lock(key)
	defer unlock()

	fn()
}

// DoRLock executes a function within a read lock for a specific key.
func (m *KeyedRWMutex) DoRLock(key string, fn func()) {
	unlock := m.RLock(key)
	defer unlock()

	fn()
}
