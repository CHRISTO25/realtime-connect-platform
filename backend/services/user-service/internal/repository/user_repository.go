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

// CreateProfile safely inserts or updates a profile row into Neon DB
func (r *ProfileRepositoryImpl) CreateProfile(ctx context.Context, profile *model.UserProfile) error {
	return r.db.WithContext(ctx).
		Where(model.UserProfile{UserID: profile.UserID}).
		Attrs(model.UserProfile{
			DisplayName: profile.DisplayName,
		}).
		FirstOrCreate(profile).Error
}

// FindByUserID queries by the indexed unique column 'user_id'
func (r *ProfileRepositoryImpl) FindByUserID(ctx context.Context, userIDStr string) (*model.UserProfile, error) {
	var profile model.UserProfile
	err := r.db.WithContext(ctx).
		Select("id, user_id, display_name, bio, location, avatar_url, cover_url, is_online, last_seen, created_at, updated_at").
		Where("user_id = ?", userIDStr).
		First(&profile).Error

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

// GetProfileByID delegates to FindByUserID
func (r *ProfileRepositoryImpl) GetProfileByID(ctx context.Context, id string) (*model.UserProfile, error) {
	return r.FindByUserID(ctx, id)
}

// UpdateProfile saves updated profile metadata using atomic column updates
func (r *ProfileRepositoryImpl) UpdateProfile(ctx context.Context, profile *model.UserProfile) error {
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

// GetAllProfilesPaginated returns all user profiles with projection selection
func (r *ProfileRepositoryImpl) GetAllProfilesPaginated(ctx context.Context, excludeUserID string, offset, limit int) ([]model.UserProfile, int64, error) {
	var profiles []model.UserProfile
	var totalCount int64

	query := r.db.WithContext(ctx).Model(&model.UserProfile{})

	if excludeUserID != "" {
		query = query.Where("user_id != ?", excludeUserID)
	}

	// 1. Fast Index-backed Count
	if err := query.Count(&totalCount).Error; err != nil {
		log.Printf("[Neon DB Query Error - Count]: %v", err)
		return nil, 0, err
	}

	// 2. Paginated Fetch with Projection (Avoids SELECT *)
	err := query.
		Select("id, user_id, display_name, bio, location, avatar_url, cover_url, is_online, last_seen, created_at").
		Offset(offset).
		Limit(limit).
		Order("created_at DESC").
		Find(&profiles).Error

	if err != nil {
		log.Printf("[Neon DB Query Error - Find]: %v", err)
		return nil, 0, err
	}

	return profiles, totalCount, nil
}

// SearchProfiles uses projection, indexed ILIKE matching, and fast subquery 2-way block exclusion
func (r *ProfileRepositoryImpl) SearchProfiles(ctx context.Context, currentUserID string, searchQuery, locationQuery string, offset, limit int) ([]model.UserProfile, int64, error) {
	var profiles []model.UserProfile
	var totalCount int64

	dbQuery := r.db.WithContext(ctx).Model(&model.UserProfile{})

	// 1. Exclude current logged-in user & 2-way blocked users using indexed subquery
	if currentUserID != "" {
		dbQuery = dbQuery.Where("user_id != ?", currentUserID)

		// High-performance subquery utilizing composite index on blocked_users(blocker_id, blocked_id)
		blockedSubQuery := r.db.Model(&model.BlockedUser{}).
			Select("CASE WHEN blocker_id = ? THEN blocked_id ELSE blocker_id END", currentUserID).
			Where("blocker_id = ? OR blocked_id = ?", currentUserID, currentUserID)

		dbQuery = dbQuery.Where("user_id NOT IN (?)", blockedSubQuery)
	}

	// 2. Case-insensitive Search Filters
	if searchQuery != "" {
		pattern := "%" + searchQuery + "%"
		dbQuery = dbQuery.Where("display_name ILIKE ? OR bio ILIKE ?", pattern, pattern)
	}

	if locationQuery != "" {
		locPattern := "%" + locationQuery + "%"
		dbQuery = dbQuery.Where("location ILIKE ?", locPattern)
	}

	// 3. Count total matching rows
	if err := dbQuery.Count(&totalCount).Error; err != nil {
		return nil, 0, err
	}

	// 4. Execute Paginated Fetch with Column Projection for maximum throughput
	err := dbQuery.
		Select("id, user_id, display_name, bio, location, avatar_url, cover_url, is_online, last_seen, created_at").
		Offset(offset).
		Limit(limit).
		Order("created_at DESC").
		Find(&profiles).Error

	if err != nil {
		return nil, 0, err
	}

	return profiles, totalCount, nil
}

func (r *ProfileRepositoryImpl) UpdateStatus(ctx context.Context, userIDStr string, isOnline bool) error {
	return r.db.WithContext(ctx).
		Model(&model.UserProfile{}).
		Where("user_id = ?", userIDStr).
		Updates(map[string]interface{}{
			"is_online": isOnline,
			"last_seen": time.Now(),
		}).Error
}
func (r *ProfileRepositoryImpl) AdminGetAllUsers(ctx context.Context, query string) ([]model.UserProfile, error) {
	var profiles []model.UserProfile
	dbQuery := r.db.WithContext(ctx)

	if query != "" {
		dbQuery = dbQuery.Where("display_name ILIKE ? OR email ILIKE ?", "%"+query+"%", "%"+query+"%")
	}

	err := dbQuery.Find(&profiles).Error
	return profiles, err
}

func (r *ProfileRepositoryImpl) AdminSetUserBanStatus(ctx context.Context, userID string, isBanned bool) error {
	return r.db.WithContext(ctx).
		Model(&model.UserProfile{}).
		Where("user_id = ? OR id = ?", userID, userID).
		Update("is_banned", isBanned).Error
}
