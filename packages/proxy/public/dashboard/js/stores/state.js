class Store extends EventTarget {
  constructor() {
    super();
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    this._state = {
      user: null,
      period: {
        from: firstOfMonth.toISOString().slice(0, 10),
        to: new Date(now.getTime() + 86400000).toISOString().slice(0, 10),
      },
      view: 'personal',
      personalData: null,
      adminData: null,
      loading: false,
      error: null,
    };
  }

  get state() {
    return this._state;
  }

  dispatch(action, payload) {
    switch (action) {
      case 'SET_USER':
        this._state = { ...this._state, user: payload };
        break;
      case 'SET_PERIOD':
        this._state = { ...this._state, period: payload };
        break;
      case 'SET_VIEW':
        this._state = { ...this._state, view: payload };
        break;
      case 'SET_PERSONAL_DATA':
        this._state = { ...this._state, personalData: payload };
        break;
      case 'SET_ADMIN_DATA':
        this._state = { ...this._state, adminData: payload };
        break;
      case 'SET_LOADING':
        this._state = { ...this._state, loading: payload };
        break;
      case 'SET_ERROR':
        this._state = { ...this._state, error: payload };
        break;
      default:
        return;
    }
    this.dispatchEvent(new CustomEvent('state-changed', { detail: { action, payload } }));
  }
}

export const store = new Store();
