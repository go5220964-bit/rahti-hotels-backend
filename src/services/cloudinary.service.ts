import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary using environment variables
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export class CloudinaryService {
  /**
   * Uploads a file buffer directly to Cloudinary.
   * Returns the secure URL of the uploaded asset.
   */
  public static async uploadFile(buffer: Buffer, folder: string, filename: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Create a upload stream
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: filename.split('.').slice(0, -1).join('-') + '-' + Date.now(),
          resource_type: 'auto',
        },
        (error, result) => {
          if (error) {
            console.error('Cloudinary upload error:', error);
            return reject(error);
          }
          if (!result) {
            return reject(new Error('Cloudinary response was empty'));
          }
          resolve(result.secure_url);
        }
      );

      // Write buffer to stream and end
      uploadStream.end(buffer);
    });
  }

  /**
   * Deletes a file from Cloudinary using its public ID.
   * Extracts the public ID from the URL if needed.
   */
  public static async deleteFile(publicId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      cloudinary.uploader.destroy(publicId, (error, result) => {
        if (error) {
          console.error('Cloudinary delete error:', error);
          return reject(error);
        }
        resolve();
      });
    });
  }

  /**
   * Helper to extract public ID from a Cloudinary secure URL.
   * Example: https://res.cloudinary.com/cloudname/image/upload/v123456/folder/filename.jpg
   * Returns: folder/filename (without version and extension)
   */
  public static getPublicIdFromUrl(url: string): string | null {
    try {
      // Find the folder and public ID section.
      // Cloudinary urls look like: .../upload/v<version>/<folder>/<public_id>.<ext>
      const parts = url.split('/upload/');
      if (parts.length < 2) return null;
      
      const pathAfterUpload = parts[1];
      // Path after upload might start with a version like v123456789/
      const subParts = pathAfterUpload.split('/');
      if (subParts[0].startsWith('v') && !isNaN(Number(subParts[0].slice(1)))) {
        // Remove the version part
        subParts.shift();
      }
      
      const fullPath = subParts.join('/');
      // Remove file extension
      const dotIndex = fullPath.lastIndexOf('.');
      if (dotIndex !== -1) {
        return fullPath.substring(0, dotIndex);
      }
      return fullPath;
    } catch (e) {
      console.error('Error parsing Cloudinary URL:', e);
      return null;
    }
  }
}
