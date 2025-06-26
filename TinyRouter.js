/**
 * TinyRouter - Librería de routing ultra-ligera
 * Versión: 1.0.0 | Tamaño: ~2KB | Sin dependencias
 * Autor: Tu nombre aquí
 */

class TinyRouter {
    constructor(options = {}) {
        this.routes = new Map();
        this.middlewares = [];
        this.notFoundHandler = null;
        this.currentPath = '';
        this.params = {};
        this.query = {};
        
        this.config = {
            mode: 'auto', // 'auto', 'hash', 'history'
            hashPrefix: '#',
            debug: false,
            ...options
        };
        
        if (this.config.mode === 'auto') {
            this.config.mode = location.protocol === 'file:' ? 'hash' : 'history';
        }
        
        this.init();
    }
    
    get(path, handler) {
        this.routes.set(path, handler);
        return this;
    }
    
    use(middleware) {
        this.middlewares.push(middleware);
        return this;
    }
    
    notFound(handler) {
        this.notFoundHandler = handler;
        return this;
    }
    
    navigate(path, replace = false) {
        try {
            if (this.config.mode === 'hash') {
                if (replace) {
                    location.replace(this.config.hashPrefix + path);
                } else {
                    location.hash = path;
                }
            } else {
                if (replace) {
                    history.replaceState({}, '', path);
                } else {
                    history.pushState({}, '', path);
                }
                this.handleRoute();
            }
        } catch (error) {
            this.config.mode = 'hash';
            location.hash = path;
        }
    }
    
    getCurrentPath() {
        if (this.config.mode === 'hash') {
            return location.hash.slice(1) || '/';
        }
        return location.pathname;
    }
    
    parseRoute(pattern, path) {
        const patternParts = pattern.split('/').filter(Boolean);
        const pathParts = path.split('?')[0].split('/').filter(Boolean);
        
        if (patternParts.length !== pathParts.length) return null;
        
        const params = {};
        for (let i = 0; i < patternParts.length; i++) {
            const patternPart = patternParts[i];
            const pathPart = pathParts[i];
            
            if (patternPart.startsWith(':')) {
                params[patternPart.slice(1)] = decodeURIComponent(pathPart);
            } else if (patternPart !== pathPart) {
                return null;
            }
        }
        return params;
    }
    
    parseQuery(path) {
        const queryIndex = path.indexOf('?');
        if (queryIndex === -1) return {};
        
        const query = {};
        const queryString = path.slice(queryIndex + 1);
        queryString.split('&').forEach(pair => {
            const [key, value] = pair.split('=');
            if (key) {
                query[decodeURIComponent(key)] = decodeURIComponent(value || '');
            }
        });
        return query;
    }
    
    async runMiddlewares(context) {
        for (const middleware of this.middlewares) {
            await new Promise(resolve => {
                middleware(context, resolve);
            });
        }
    }
    
    async handleRoute() {
        const path = this.getCurrentPath();
        this.currentPath = path;
        this.query = this.parseQuery(path);
        
        const context = {
            path,
            query: this.query,
            params: {},
            router: this
        };
        
        await this.runMiddlewares(context);
        
        for (const [pattern, handler] of this.routes) {
            const params = this.parseRoute(pattern, path.split('?')[0]);
            if (params !== null) {
                context.params = params;
                this.params = params;
                
                if (this.config.debug) {
                    console.log(`TinyRouter: ${pattern} matched`, context);
                }
                
                return handler(context);
            }
        }
        
        if (this.notFoundHandler) {
            this.notFoundHandler(context);
        } else if (this.config.debug) {
            console.warn(`TinyRouter: No route found for ${path}`);
        }
    }
    
    init() {
        if (this.config.mode === 'hash') {
            window.addEventListener('hashchange', () => this.handleRoute());
        } else {
            window.addEventListener('popstate', () => this.handleRoute());
        }
        
        this.handleRoute();
        this.bindLinks();
        
        if (this.config.debug) {
            console.log(`TinyRouter initialized in ${this.config.mode} mode`);
        }
    }
    
    bindLinks() {
        document.addEventListener('click', (e) => {
            const link = e.target.closest('[data-route]');
            if (link) {
                e.preventDefault();
                const route = link.getAttribute('data-route');
                this.navigate(route);
                this.updateActiveLinks(route);
            }
        });
    }
    
    updateActiveLinks(currentRoute) {
        document.querySelectorAll('[data-route]').forEach(link => {
            const route = link.getAttribute('data-route');
            if (route === currentRoute) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
    }
}

// Exportar para uso global
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TinyRouter;
} else {
    window.TinyRouter = TinyRouter;
}