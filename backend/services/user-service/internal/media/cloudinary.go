package media

import (
	"context"
	"fmt"
	"mime/multipart"
	"os"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
)

type MediaUploader struct {
	cld *cloudinary.Cloudinary
}

func NewMediaUploader() (*MediaUploader, error) {
	cloudName := os.Getenv("CLOUDINARY_CLOUD_NAME")
	apiKey := os.Getenv("CLOUDINARY_API_KEY")
	apiSecret := os.Getenv("CLOUDINARY_API_SECRET")

	if cloudName == "" || apiKey == "" || apiSecret == "" {
		return nil, fmt.Errorf("missing Cloudinary environment variables")
	}

	cld, err := cloudinary.NewFromParams(cloudName, apiKey, apiSecret)
	if err != nil {
		return nil, err
	}

	return &MediaUploader{cld: cld}, nil
}

// UploadImage receives a multipart file header and uploads it to a specific folder in Cloudinary
func (m *MediaUploader) UploadImage(ctx context.Context, fileHeader *multipart.FileHeader, folder string) (string, error) {
	file, err := fileHeader.Open()
	if err != nil {
		return "", fmt.Errorf("failed to open upload file: %w", err)
	}
	defer file.Close()

	uploadResult, err := m.cld.Upload.Upload(ctx, file, uploader.UploadParams{
		Folder: folder,
	})
	if err != nil {
		return "", fmt.Errorf("cloudinary upload failed: %w", err)
	}

	return uploadResult.SecureURL, nil
}
