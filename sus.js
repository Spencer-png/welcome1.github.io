const ForumDB = {
  init() {
    if (!localStorage.getItem('forumUsers')) {
      localStorage.setItem('forumUsers', JSON.stringify([]));
      localStorage.setItem('forumPosts', JSON.stringify([]));
      localStorage.setItem('forumCategories', JSON.stringify([
        'AI/ML', 'Quantum', 'Security', 'Web Dev', 'Mobile Dev', 'DevOps'
      ]));
      localStorage.setItem('forumComments', JSON.stringify([]));
      localStorage.setItem('currentUser', '');
    }
  },

  users: {
    create(userData) {
      const users = JSON.parse(localStorage.getItem('forumUsers'));
      if (users.find(u => u.username === userData.username)) {
        throw new Error('Username already exists');
      }
      const newUser = {
        id: crypto.randomUUID(),
        ...userData,
        joinDate: new Date().toISOString(),
        lastActive: new Date().toISOString(),
        reputation: 0,
        posts: 0,
        role: 'user'
      };
      users.push(newUser);
      localStorage.setItem('forumUsers', JSON.stringify(users));
      return newUser;
    },

    authenticate(username, password) {
      const users = JSON.parse(localStorage.getItem('forumUsers'));
      const user = users.find(u => u.username === username);
      if (!user || user.password !== password) { 
        throw new Error('Invalid credentials');
      }
      user.lastActive = new Date().toISOString();
      localStorage.setItem('currentUser', user.id);
      return user;
    },

    getCurrentUser() {
      const userId = localStorage.getItem('currentUser');
      if (!userId) return null;
      const users = JSON.parse(localStorage.getItem('forumUsers'));
      return users.find(u => u.id === userId);
    },

    updateProfile(userId, updateData) {
      const users = JSON.parse(localStorage.getItem('forumUsers'));
      const userIndex = users.findIndex(u => u.id === userId);
      if (userIndex === -1) throw new Error('User not found');
      users[userIndex] = { ...users[userIndex], ...updateData };
      localStorage.setItem('forumUsers', JSON.stringify(users));
      return users[userIndex];
    }
  },

  posts: {
    create(postData) {
      const currentUser = this.users.getCurrentUser();
      if (!currentUser) throw new Error('Must be logged in to post');

      const posts = JSON.parse(localStorage.getItem('forumPosts'));
      const newPost = {
        id: crypto.randomUUID(),
        ...postData,
        authorId: currentUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        views: 0,
        likes: 0,
        status: 'active'
      };
      posts.push(newPost);
      localStorage.setItem('forumPosts', JSON.stringify(posts));
      return newPost;
    },

    getAll(filters = {}) {
      let posts = JSON.parse(localStorage.getItem('forumPosts'));
      
      if (filters.category) {
        posts = posts.filter(p => p.category === filters.category);
      }
      if (filters.author) {
        posts = posts.filter(p => p.authorId === filters.author);
      }
      if (filters.sortBy === 'recent') {
        posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }
      return posts;
    },

    get(postId) {
      const posts = JSON.parse(localStorage.getItem('forumPosts'));
      const post = posts.find(p => p.id === postId);
      if (!post) throw new Error('Post not found');
      post.views++;
      localStorage.setItem('forumPosts', JSON.stringify(posts));
      return post;
    },

    update(postId, updateData) {
      const currentUser = this.users.getCurrentUser();
      const posts = JSON.parse(localStorage.getItem('forumPosts'));
      const postIndex = posts.findIndex(p => p.id === postId);
      
      if (postIndex === -1) throw new Error('Post not found');
      if (posts[postIndex].authorId !== currentUser?.id) {
        throw new Error('Not authorized to edit this post');
      }

      posts[postIndex] = {
        ...posts[postIndex],
        ...updateData,
        updatedAt: new Date().toISOString()
      };
      localStorage.setItem('forumPosts', JSON.stringify(posts));
      return posts[postIndex];
    }
  },

  comments: {
    create(postId, content) {
      const currentUser = this.users.getCurrentUser();
      if (!currentUser) throw new Error('Must be logged in to comment');

      const comments = JSON.parse(localStorage.getItem('forumComments'));
      const newComment = {
        id: crypto.randomUUID(),
        postId,
        content,
        authorId: currentUser.id,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        likes: 0
      };
      comments.push(newComment);
      localStorage.setItem('forumComments', JSON.stringify(comments));
      return newComment;
    },

    getForPost(postId) {
      const comments = JSON.parse(localStorage.getItem('forumComments'));
      return comments.filter(c => c.postId === postId)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  },

  search: {
    async searchContent(query) {
      const posts = JSON.parse(localStorage.getItem('forumPosts'));
      const comments = JSON.parse(localStorage.getItem('forumComments'));
      
      const results = {
        posts: posts.filter(p => 
          p.title.toLowerCase().includes(query.toLowerCase()) ||
          p.content.toLowerCase().includes(query.toLowerCase())
        ),
        comments: comments.filter(c =>
          c.content.toLowerCase().includes(query.toLowerCase())
        )
      };
      
      return results;
    }
  },

  stats: {
    getForumStats() {
      const posts = JSON.parse(localStorage.getItem('forumPosts'));
      const users = JSON.parse(localStorage.getItem('forumUsers'));
      const comments = JSON.parse(localStorage.getItem('forumComments'));

      return {
        totalPosts: posts.length,
        totalUsers: users.length,
        totalComments: comments.length,
        activeUsers: users.filter(u => {
          const lastActive = new Date(u.lastActive);
          const hourAgo = new Date(Date.now() - 3600000);
          return lastActive > hourAgo;
        }).length,
        topCategories: this.getTopCategories(posts),
        recentActivity: this.getRecentActivity(posts, comments)
      };
    },

    getTopCategories(posts) {
      const categories = {};
      posts.forEach(post => {
        categories[post.category] = (categories[post.category] || 0) + 1;
      });
      return Object.entries(categories)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5);
    },

    getRecentActivity(posts, comments) {
      const activity = [
        ...posts.map(p => ({ type: 'post', ...p })),
        ...comments.map(c => ({ type: 'comment', ...c }))
      ];
      return activity
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 10);
    }
  }
};

const ForumEventHandlers = {
  async handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    
    try {
      const user = await ForumDB.users.authenticate(username, password);
      this.updateUIForLoggedInUser(user);
    } catch (error) {
      this.showError(error.message);
    }
  },

  async handleCreatePost(event) {
    event.preventDefault();
    const title = document.getElementById('postTitle').value;
    const content = document.getElementById('postContent').value;
    const category = document.getElementById('postCategory').value;

    try {
      const post = await ForumDB.posts.create({ title, content, category });
      this.addPostToFeed(post);
    } catch (error) {
      this.showError(error.message);
    }
  },

  updateUIForLoggedInUser(user) {
    const authSection = document.querySelector('.auth-section');
    const userSection = document.querySelector('.user-section');
    
    if (user) {
      authSection?.classList.add('hidden');
      userSection?.classList.remove('hidden');
      document.querySelector('.user-name').textContent = user.username;
    }
  },

  addPostToFeed(post) {
    const feed = document.querySelector('.forum-feed');
    const postElement = this.createPostElement(post);
    feed.insertBefore(postElement, feed.firstChild);
  },

  createPostElement(post) {
    const div = document.createElement('div');
    div.className = 'forum-card';
    div.innerHTML = `
      <h2 class="topic-title">${post.title}</h2>
      <div class="topic-meta">
        <div class="stats">
          <span>Views: ${post.views}</span>
          <span>Likes: ${post.likes}</span>
        </div>
        <span>Category: ${post.category}</span>
      </div>
      <div class="latest-post">
        Posted by: ${post.authorId}
        <br>at ${new Date(post.createdAt).toLocaleString()}
      </div>
    `;
    return div;
  },

  showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    setTimeout(() => errorDiv.remove(), 3000);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  ForumDB.init();
  
  document.querySelector('.login-form')?.addEventListener('submit', ForumEventHandlers.handleLogin.bind(ForumEventHandlers));
  document.querySelector('.create-post-form')?.addEventListener('submit', ForumEventHandlers.handleCreatePost.bind(ForumEventHandlers));
});
