const mongoose = require('mongoose');
const mongoosePaginate = require('mongoose-paginate-v2')


const userSchema = new mongoose.Schema({
  email: {
    type:String,
    required:[true, 'Email field is required']
  },
  password: {
    type:String,
    required:[true, 'Password fields is required'],
    minlength: [6, 'atleast 6 characters required']
  },
  weights: [{ 
    weight: { type: Number, required: true }, 
    date: { type: Date, default: Date.now } 
}]
});
userSchema.plugin(mongoosePaginate);
const User = mongoose.model('User', userSchema);

module.exports = User;