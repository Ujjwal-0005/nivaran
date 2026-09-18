import multer from 'multer'

const storage = multer.memoryStorage()

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    console.log('File filter called for:', file.originalname, file.mimetype)
    const allowedTypes = /jpeg|jpg|png/
    const extname = allowedTypes.test(file.mimetype)
    
    if (extname) {
      return cb(null, true)
    } else {
      cb(new Error('Only JPEG, JPG, and PNG images are allowed'))
    }
  },
})

export default upload
