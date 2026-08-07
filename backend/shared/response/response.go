package response

import (
	"net/http"
	"shared/errors"
	"shared/validator"

	"github.com/gin-gonic/gin"
)

// APIResponse represents the standardized JSON structure sent to clients
type APIResponse struct {
	Success bool        `json:"success"`
	Message string      `json:"message,omitempty"`
	Data    interface{} `json:"data,omitempty"`
	Errors  interface{} `json:"errors,omitempty"`
	Code    string      `json:"code,omitempty"`
}

// Success returns a standard HTTP 200 OK JSON response
func Success(c *gin.Context, message string, data interface{}) {
	c.JSON(http.StatusOK, APIResponse{
		Success: true,
		Message: message,
		Data:    data,
	})
}

// Created returns a standard HTTP 201 Created JSON response
func Created(c *gin.Context, message string, data interface{}) {
	c.JSON(http.StatusCreated, APIResponse{
		Success: true,
		Message: message,
		Data:    data,
	})
}

// Error returns a flexible error response (supports HTTP status code + message string)
func Error(c *gin.Context, status int, message string) {
	c.JSON(status, APIResponse{
		Success: false,
		Message: message,
	})
}

// AppError accepts a custom *errors.AppError struct and extracts status code + domain error code
func AppError(c *gin.Context, err *errors.AppError) {
	if err == nil {
		c.JSON(http.StatusInternalServerError, APIResponse{
			Success: false,
			Message: "An unexpected error occurred",
			Code:    "INTERNAL_ERROR",
		})
		return
	}

	c.JSON(err.StatusCode, APIResponse{
		Success: false,
		Message: err.Message,
		Code:    err.Code,
	})
}

// ValidationError formats binding errors into clean field-by-field validation maps
func ValidationError(c *gin.Context, err error) {
	formattedErrors := validator.FormatValidationError(err)

	c.JSON(http.StatusBadRequest, APIResponse{
		Success: false,
		Message: "Validation failed on request payload",
		Errors:  formattedErrors,
		Code:    "VALIDATION_ERROR",
	})
}
