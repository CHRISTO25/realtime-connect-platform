package handler

import (
	"context"
	"net/http"
	"os"

	"github.com/cloudinary/cloudinary-go/v2"
	"github.com/cloudinary/cloudinary-go/v2/api/uploader"
	"github.com/gin-gonic/gin"
	"shared/response"
)

func (h *ChatHandler) UploadFile(c *gin.Context) {
	// 1. Retrieve file from multipart form field 'file'
	file, err := c.FormFile("file")
	if err != nil {
		response.Error(c, http.StatusBadRequest, "No file attachment provided")
		return
	}

	// 2. Open multipart file stream
	src, err := file.Open()
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Failed to read file stream")
		return
	}
	defer src.Close()

	// 3. Initialize Cloudinary from environment variable
	cldURL := os.Getenv("CLOUDINARY_URL")
	if cldURL == "" {
		response.Error(c, http.StatusInternalServerError, "Cloudinary configuration missing")
		return
	}

	cld, err := cloudinary.NewFromURL(cldURL)
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Failed to initialize Cloudinary client")
		return
	}

	// 4. Upload file stream to Cloudinary bucket
	ctx := context.Background()
	uploadResult, err := cld.Upload.Upload(ctx, src, uploader.UploadParams{
		Folder: "chattings_media",
	})
	if err != nil {
		response.Error(c, http.StatusInternalServerError, "Failed to upload file to Cloudinary cloud storage")
		return
	}

	// 5. Return secure Cloudinary asset URL
	response.Success(c, "File uploaded to Cloudinary successfully", gin.H{
		"file_url": uploadResult.SecureURL,
		"filename": file.Filename,
		"size":     file.Size,
	})
}
