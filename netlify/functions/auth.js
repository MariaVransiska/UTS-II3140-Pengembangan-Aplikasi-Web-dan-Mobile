const jwt = require('jsonwebtoken');
const { connectToDatabase } = require('./db');
const { getUserModel } = require('./models/user');

exports.handler = async (event, context) => {
  // Connect to Supabase
  await connectToDatabase();
  
  const { httpMethod, path, body, headers } = event;
  
  // Clean path (remove function prefix if present)
  let cleanPath = path || '';
  cleanPath = cleanPath.replace('/.netlify/functions/server', '');
  cleanPath = cleanPath.replace('/api/auth', '');
  if (!cleanPath.startsWith('/')) {
    cleanPath = '/' + cleanPath;
  }
  
  // Parse body if present
  let data = {};
  if (body) {
    try {
      data = typeof body === 'string' ? JSON.parse(body) : body;
    } catch (e) {
      // Body might already be parsed
      data = body;
    }
  }
  
  try {
    switch (httpMethod) {
      case 'POST':
        if (cleanPath.endsWith('/register') || cleanPath === '/register') {
          return await handleRegister(data);
        } else if (cleanPath.endsWith('/login') || cleanPath === '/login') {
          return await handleLogin(data);
        }
        break;
      case 'GET':
        if (cleanPath.endsWith('/me') || cleanPath === '/me') {
          return await handleGetMe(event);
        }
        break;
      case 'PUT':
        if (cleanPath.endsWith('/profile') || cleanPath === '/profile') {
          return await handleUpdateProfile(data, event);
        } else if (cleanPath.endsWith('/password') || cleanPath === '/password') {
          return await handleChangePassword(data, event);
        }
        break;
      case 'POST':
      case 'DELETE':
        if (cleanPath.endsWith('/logout') || cleanPath === '/logout') {
          return await handleLogout(event);
        }
        break;
      default:
        return {
          statusCode: 405,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
          },
          body: JSON.stringify({ success: false, message: 'Method not allowed' })
        };
    }
    
    // If no route matched
    return {
      statusCode: 404,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, message: 'Endpoint not found', path: cleanPath })
    };
  } catch (error) {
    console.error('Auth handler error:', error);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, message: error.message || 'Internal server error' })
    };
  }
};

async function handleRegister(data) {
  const { name, email, password, nim, kelas, gender } = data;
  
  if (!name || !email || !password || !nim || !kelas || !gender) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, message: 'Semua field harus diisi' })
    };
  }
  
  const User = await getUserModel();
  
  // Check for existing user
  let existingUser = await User.findOne({ email });
  if (!existingUser) {
    existingUser = await User.findOne({ nim });
  }
  
  if (existingUser) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: false,
        message: existingUser.email === email ? 'Email sudah terdaftar' : 'NIM sudah terdaftar'
      })
    };
  }
  
  const user = await User.create({ name, email, password, nim, kelas, gender });
  
  const token = jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
  
  return {
    statusCode: 201,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: true,
      message: 'Registrasi berhasil',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          nim: user.nim,
          kelas: user.kelas,
          gender: user.gender,
          progress: user.progress,
          statistics: user.statistics
        },
        token
      }
    })
  };
}

async function handleLogin(data) {
  const { email, password } = data;
  
  if (!email || !password) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, message: 'Email dan password harus diisi' })
    };
  }
  
  const User = await getUserModel();
  const supabase = await connectToDatabase();
  
  // Get user with password
  const { data: userData, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();
  
  if (error || !userData) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, message: 'Email atau password salah' })
    };
  }
  
  const user = User.formatUser(userData);
  const isPasswordValid = await user.comparePassword(password);
  
  if (!isPasswordValid) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, message: 'Email atau password salah' })
    };
  }
  
  await user.updateLastLogin();
  
  const token = jwt.sign(
    { id: user.id },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
  
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({
      success: true,
      message: 'Login berhasil',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          nim: user.nim,
          kelas: user.kelas,
          gender: user.gender,
          progress: user.progress,
          statistics: user.statistics
        },
        token
      }
    })
  };
}

async function handleGetMe(event) {
  const token = event.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, message: 'Token tidak ditemukan' })
    };
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const User = await getUserModel();
    const user = await User.findById(decoded.id, { select: '-password' });
    
    if (!user) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ success: false, message: 'User tidak ditemukan' })
      };
    }
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        data: {
          user: {
            id: user.id,
            name: user.name,
            email: user.email,
            nim: user.nim,
            kelas: user.kelas,
            gender: user.gender,
            progress: user.progress,
            statistics: user.statistics
          }
        }
      })
    };
  } catch (error) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, message: 'Token tidak valid' })
    };
  }
}

async function handleUpdateProfile(data, event) {
  const token = event.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, message: 'Token tidak ditemukan' })
    };
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const User = await getUserModel();
    const user = await User.findByIdAndUpdate(
      decoded.id,
      { ...data, updatedAt: new Date() },
      { new: true }
    );
    
    if (!user) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ success: false, message: 'User tidak ditemukan' })
      };
    }
    
    // Remove password from response
    delete user.password;
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({
        success: true,
        message: 'Profil berhasil diperbarui',
        data: { user }
      })
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, message: error.message })
    };
  }
}

async function handleChangePassword(data, event) {
  const token = event.headers.authorization?.replace('Bearer ', '');
  
  if (!token) {
    return {
      statusCode: 401,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, message: 'Token tidak ditemukan' })
    };
  }
  
  const { currentPassword, newPassword } = data;
  
  if (!currentPassword || !newPassword) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, message: 'Password lama dan baru harus diisi' })
    };
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const User = await getUserModel();
    const supabase = await connectToDatabase();
    
    // Get user with password
    const { data: userData, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', decoded.id)
      .single();
    
    if (error || !userData) {
      return {
        statusCode: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ success: false, message: 'User tidak ditemukan' })
      };
    }
    
    const user = User.formatUser(userData);
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);
    
    if (!isCurrentPasswordValid) {
      return {
        statusCode: 400,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        },
        body: JSON.stringify({ success: false, message: 'Password lama salah' })
      };
    }
    
    await User.updatePassword(decoded.id, newPassword);
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: true, message: 'Password berhasil diubah' })
    };
  } catch (error) {
    return {
      statusCode: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ success: false, message: error.message })
    };
  }
}

async function handleLogout(event) {
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ success: true, message: 'Logout berhasil' })
  };
}
