import jwt from 'jsonwebtoken'

const genToken = (userId, authVersion = 0)=>{
    return jwt.sign({userId, authVersion},process.env.jwt_secret,{expiresIn:"10d", algorithm: "HS256"})
}

export default genToken
