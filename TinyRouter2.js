class TinyRouter {
            constructor(options = {}) {
                this.routes = new Map();
                this.guards = new Map();
                this.middleware = [];
                this.routeCache = new Map();
                
                this.config = {
                    defaultRoute: '/',
                    notFoundHandler: null,
                    beforeRoute: null,
                    afterRoute: null,
                    basePath: '',
                    debug: false,
                    autoStart: true,
                    cacheMatches: true,
                    maxCacheSize: 100,
                    ...options
                };
                
                this.currentRoute = null;
                this.currentParams = {};
                this.currentQuery = {};
                this.isInitialized = false;
                this.history = [];
                this.historyIndex = -1;
                this.isNavigating = false;
                
                this.metrics = {
                    totalNavigations: 0,
                    cacheHits: 0,
                    cacheMisses: 0,
                    averageRouteTime: 0
                };
                
                if (this.config.autoStart) {
                    this.init();
                }
            }
            
            route(pattern, handler, options = {}) {
                const compiledRoute = this.compileRoute(pattern);
                this.routes.set(pattern, {
                    pattern, handler, compiled: compiledRoute, options
                });
                this.log(`✅ Route registered: ${pattern}`);
                return this;
            }
            
            guard(patternOrGuard, guard = null) {
                if (typeof patternOrGuard === 'function') {
                    this.middleware.push({ type: 'guard', handler: patternOrGuard });
                } else {
                    this.guards.set(patternOrGuard, guard);
                }
                this.log(`🛡️ Guard registered`);
                return this;
            }
            
            async navigate(path, query = {}) {
                if (this.isNavigating) return false;
                
                this.isNavigating = true;
                try {
                    const url = this.buildUrl(path, query);
                    this.log(`🧭 Navigating to: ${url}`);
                    window.location.hash = url;
                    return true;
                } finally {
                    this.isNavigating = false;
                    this.metrics.totalNavigations++;
                }
            }
            
            compileRoute(pattern) {
                const paramNames = [];
                let regexPattern = pattern
                    .replace(/[.+*?^${}()|[\]\\]/g, '\\$&')
                    .replace(/\\:(\w+)/g, (match, paramName) => {
                        paramNames.push(paramName);
                        return '([^/]+)';
                    });
                
                return {
                    regex: new RegExp('^' + regexPattern + '$'),
                    paramNames
                };
            }
            
            findMatchingRoute(path) {
                for (const [pattern, route] of this.routes) {
                    const match = path.match(route.compiled.regex);
                    if (match) {
                        const params = {};
                        route.compiled.paramNames.forEach((name, index) => {
                            params[name] = match[index + 1];
                        });
                        return { route, params, pattern };
                    }
                }
                return null;
            }
            
            async handleRouteChange() {
                let currentPath = window.location.hash.slice(1) || this.config.defaultRoute;
                const [path, queryString] = currentPath.split('?');
                
                this.currentQuery = this.parseQueryString(queryString || '');
                const matchResult = this.findMatchingRoute(path);
                
                if (matchResult) {
                    this.currentRoute = path;
                    this.currentParams = matchResult.params;
                    
                    try {
                        await matchResult.route.handler(matchResult.params, this.currentQuery, path);
                        
                        if (this.config.afterRoute) {
                            await this.config.afterRoute(this.getCurrentRoute());
                        }
                    } catch (error) {
                        this.log('❌ Error executing route handler:', error);
                    }
                } else {
                    await this.handleNotFound(path);
                }
            }
            
            async handleNotFound(path) {
                this.log(`🔍 Route not found: ${path}`);
                if (this.config.notFoundHandler) {
                    await this.config.notFoundHandler(path, this.currentQuery);
                }
            }
            
            buildUrl(path, query = {}) {
                let url = this.config.basePath + path;
                const queryString = this.buildQueryString(query);
                if (queryString) url += '?' + queryString;
                return url;
            }
            
            buildQueryString(query) {
                return Object.entries(query)
                    .filter(([_, value]) => value !== null && value !== undefined && value !== '')
                    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
                    .join('&');
            }
            
            parseQueryString(queryString) {
                const params = {};
                if (!queryString) return params;
                
                queryString.split('&').forEach(param => {
                    const [key, value] = param.split('=');
                    if (key) {
                        params[decodeURIComponent(key)] = decodeURIComponent(value || '');
                    }
                });
                
                return params;
            }
            
            getCurrentRoute() {
                return {
                    path: this.currentRoute,
                    params: { ...this.currentParams },
                    query: { ...this.currentQuery }
                };
            }
            
            getMetrics() {
                return { ...this.metrics };
            }
            
            log(...args) {
                if (this.config.debug) {
                    console.log('[TinyRouter]', ...args);
                }
            }
            
            init() {
                if (this.isInitialized) return this;
                
                this.handleRouteChange = this.handleRouteChange.bind(this);
                window.addEventListener('hashchange', this.handleRouteChange);
                window.addEventListener('popstate', this.handleRouteChange);
                
                this.isInitialized = true;
                this.handleRouteChange();
                
                this.log('🚀 TinyRouter initialized');
                return this;
            }
            
            destroy() {
                if (!this.isInitialized) return;
                
                window.removeEventListener('hashchange', this.handleRouteChange);
                window.removeEventListener('popstate', this.handleRouteChange);
                
                this.routes.clear();
                this.guards.clear();
                this.middleware = [];
                this.routeCache.clear();
                this.history = [];
                this.isInitialized = false;
                
                this.log('🔥 TinyRouter destroyed');
            }
        }
