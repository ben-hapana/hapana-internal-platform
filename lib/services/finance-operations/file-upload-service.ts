import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'
import { storage } from '@/firebase/firebase'
import { Timestamp } from 'firebase/firestore'
import { FileReference } from '@/lib/types/finance-operations'
import { financeService } from './finance-service'

export class FileUploadService {
  private readonly ALLOWED_MIME_TYPES = [
    'text/csv',
    'application/csv',
    'text/plain'
  ]
  
  private readonly MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
  private readonly STORAGE_PATH = 'finance-operations'

  async validateFile(file: File): Promise<{ valid: boolean; error?: string }> {
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size exceeds maximum limit of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`
      }
    }

    // Check file type
    if (!this.ALLOWED_MIME_TYPES.includes(file.type) && !file.name.toLowerCase().endsWith('.csv')) {
      return {
        valid: false,
        error: 'Only CSV files are allowed'
      }
    }

    // Basic CSV content validation
    try {
      const text = await file.text()
      const lines = text.split('\n')
      
      if (lines.length < 2) {
        return {
          valid: false,
          error: 'CSV file must contain at least a header row and one data row'
        }
      }

      // Check if first line looks like a header (contains commas)
      if (!lines[0].includes(',')) {
        return {
          valid: false,
          error: 'CSV file must have a valid header row with comma-separated values'
        }
      }
    } catch {
      return {
        valid: false,
        error: 'Unable to read file content'
      }
    }

    return { valid: true }
  }

  async uploadFile(
    file: File, 
    userId: string
  ): Promise<FileReference> {
    // Validate file first
    const validation = await this.validateFile(file)
    if (!validation.valid) {
      throw new Error(validation.error)
    }

    // Generate unique filename
    const timestamp = Date.now()
    const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const filename = `${timestamp}_${sanitizedName}`
    const storagePath = `${this.STORAGE_PATH}/${userId}/${filename}`

    try {
      // Upload to Firebase Storage
      const storageRef = ref(storage, storagePath)
      const snapshot = await uploadBytes(storageRef, file)
      
      // Get download URL
      const downloadUrl = await getDownloadURL(snapshot.ref)

      // Generate checksum (simple hash for integrity)
      const checksum = await this.generateChecksum(file)

      // Create file reference
      const fileReference: Omit<FileReference, 'id'> = {
        filename,
        originalName: file.name,
        size: file.size,
        mimeType: file.type || 'text/csv',
        uploadedBy: userId,
        uploadedAt: Timestamp.now(),
        storagePath,
        downloadUrl,
        checksum
      }

      // Save to Firestore
      const fileId = await financeService.createFileReference(fileReference)

      return {
        id: fileId,
        ...fileReference
      }

    } catch (error) {
      console.error('File upload failed:', error)
      throw new Error('Failed to upload file. Please try again.')
    }
  }

  async deleteFile(fileId: string): Promise<void> {
    try {
      // Get file reference
      const fileRef = await financeService.getFileReference(fileId)
      if (!fileRef) {
        throw new Error('File not found')
      }

      // Delete from Storage
      const storageRef = ref(storage, fileRef.storagePath)
      await deleteObject(storageRef)

      // Note: We don't delete the Firestore record for audit purposes
      // The file reference remains for audit trail
      console.log(`File ${fileId} deleted from storage, reference preserved for audit`)

    } catch (error) {
      console.error('File deletion failed:', error)
      throw new Error('Failed to delete file')
    }
  }

  async getFileContent(fileId: string): Promise<string> {
    try {
      const fileRef = await financeService.getFileReference(fileId)
      if (!fileRef || !fileRef.downloadUrl) {
        throw new Error('File not found or download URL not available')
      }

      const response = await fetch(fileRef.downloadUrl)
      if (!response.ok) {
        throw new Error('Failed to download file')
      }

      return await response.text()
    } catch (error) {
      console.error('Failed to get file content:', error)
      throw new Error('Failed to retrieve file content')
    }
  }

  private async generateChecksum(file: File): Promise<string> {
    try {
      const buffer = await file.arrayBuffer()
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
      const hashArray = Array.from(new Uint8Array(hashBuffer))
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    } catch (error) {
      console.error('Checksum generation failed:', error)
      // Return a simple timestamp-based hash as fallback
      return `fallback_${Date.now()}_${file.size}`
    }
  }

  async validateFileIntegrity(fileId: string): Promise<boolean> {
    try {
      const fileRef = await financeService.getFileReference(fileId)
      if (!fileRef) return false

      // Re-download and verify checksum
      const content = await this.getFileContent(fileId)
      const blob = new Blob([content], { type: 'text/csv' })
      const file = new File([blob], fileRef.originalName, { type: 'text/csv' })
      
      const newChecksum = await this.generateChecksum(file)
      return newChecksum === fileRef.checksum
    } catch (error) {
      console.error('File integrity check failed:', error)
      return false
    }
  }
}

export const fileUploadService = new FileUploadService() 