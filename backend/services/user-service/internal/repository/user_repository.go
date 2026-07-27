package repository

import (
	"context"
	"errors"
	"log"
	"time"
	"user-service/internal/model"

	"gorm.io/gorm"
)

type ProfileRepositoryImpl struct {
	db *gorm.DB
}

func NewProfileRepository(db *gorm.DB) ProfileRepository {
	return &ProfileRepositoryImpl{db: db}
}

// CreateProfile inserts a new profile row into Neon DB
func (r *ProfileRepositoryImpl) CreateProfile(ctx context.Context, profile *model.UserProfile) error {
	return r.db.WithContext(ctx).Create(profile).Error
}

// FindByUserID queries by the foreign key column 'user_id' (Auth Service UUID)
func (r *ProfileRepositoryImpl) FindByUserID(ctx context.Context, userIDStr string) (*model.UserProfile, error) {
	var profile model.UserProfile
	err := r.db.WithContext(ctx).Where("user_id = ?", userIDStr).First(&profile).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// 🛡️ SELF-HEAL: If row was missed during registration sync, auto-seed it now!
			log.Printf("[Self-Heal] Profile missing for user_id %s in Neon DB. Creating default profile...", userIDStr)

			displayName := "User_" + userIDStr
			if len(userIDStr) >= 8 {
				displayName = "User_" + userIDStr[:8]
			}

			newProfile := model.UserProfile{
				ID:          userIDStr,
				UserID:      userIDStr,
				DisplayName: displayName,
			}
			if createErr := r.db.WithContext(ctx).Create(&newProfile).Error; createErr != nil {
				return nil, errors.New("self-healing failed to create profile: " + createErr.Error())
			}
			return &newProfile, nil
		}
		return nil, err
	}
	return &profile, nil
}

// GetProfileByID queries by user_id column to match the auth service user ID seamlessly
func (r *ProfileRepositoryImpl) GetProfileByID(ctx context.Context, id string) (*model.UserProfile, error) {
	return r.FindByUserID(ctx, id)
}

// UpdateProfile saves updated profile metadata
func (r *ProfileRepositoryImpl) UpdateProfile(ctx context.Context, profile *model.UserProfile) error {
	// 🛡️ Model(&model.UserProfile{}) tells GORM which table/model to update
	return r.db.WithContext(ctx).
		Model(&model.UserProfile{}).
		Where("user_id = ?", profile.UserID).
		Updates(map[string]interface{}{
			"display_name": profile.DisplayName,
			"bio":          profile.Bio,
			"location":     profile.Location,
			"avatar_url":   profile.AvatarURL,
			"cover_url":    profile.CoverURL,
			"updated_at":   time.Now(),
		}).Error
}

// UpdateStatus updates online presence by user_id
func (r *ProfileRepositoryImpl) UpdateStatus(ctx context.Context, userIDStr string, isOnline bool) error {
	return r.db.WithContext(ctx).Model(&model.UserProfile{}).
		Where("user_id = ?", userIDStr).
		Updates(map[string]interface{}{
			"is_online": isOnline,
			"last_seen": time.Now(),
		}).Error
}

// GetAllProfilesPaginated returns all user profiles excluding the logged-in user
func (r *ProfileRepositoryImpl) GetAllProfilesPaginated(ctx context.Context, excludeUserID string, offset, limit int) ([]model.UserProfile, int64, error) {
	var profiles []model.UserProfile
	var totalCount int64

	query := r.db.WithContext(ctx).Model(&model.UserProfile{})

	if excludeUserID != "" {
		query = query.Where("user_id != ?", excludeUserID)
	}

	// Execute Count
	if err := query.Count(&totalCount).Error; err != nil {
		log.Printf("[Neon DB Query Error - Count]: %v", err)
		return nil, 0, err
	}

	// Execute Paginated Fetch
	err := query.Offset(offset).Limit(limit).Order("created_at desc").Find(&profiles).Error
	if err != nil {
		log.Printf("[Neon DB Query Error - Find]: %v", err)
		return nil, 0, err
	}

	return profiles, totalCount, nil
}

// SearchProfiles queries profiles using server-side ILIKE filters & automatic 2-way block exclusion
func (r *ProfileRepositoryImpl) SearchProfiles(ctx context.Context, currentUserID string, searchQuery, locationQuery string, offset, limit int) ([]model.UserProfile, int64, error) {
	var profiles []model.UserProfile
	var totalCount int64

	dbQuery := r.db.WithContext(ctx).Model(&model.UserProfile{})

	// 1. Exclude current logged-in user
	if currentUserID != "" {
		dbQuery = dbQuery.Where("user_id != ?", currentUserID)

		// 2. Subquery to automatically exclude bidirectional blocked users
		blockedSubQuery := r.db.Model(&model.BlockedUser{}).
			Select("CASE WHEN blocker_id = ? THEN blocked_id ELSE blocker_id END", currentUserID).
			Where("blocker_id = ? OR blocked_id = ?", currentUserID, currentUserID)

		dbQuery = dbQuery.Where("user_id NOT IN (?)", blockedSubQuery)
	}

	// 3. Search query filter (Case-insensitive matching for display name or bio)
	if searchQuery != "" {
		pattern := "%" + searchQuery + "%"
		dbQuery = dbQuery.Where("display_name ILIKE ? OR bio ILIKE ?", pattern, pattern)
	}

	// 4. Location query filter
	if locationQuery != "" {
		locPattern := "%" + locationQuery + "%"
		dbQuery = dbQuery.Where("location ILIKE ?", locPattern)
	}

	// 5. Total Count matching filters
	if err := dbQuery.Count(&totalCount).Error; err != nil {
		return nil, 0, err
	}

	// 6. Paginated Query Execution
	err := dbQuery.
		Offset(offset).
		Limit(limit).
		Order("created_at DESC").
		Find(&profiles).Error

	if err != nil {
		return nil, 0, err
	}

	return profiles, totalCount, nil
}
