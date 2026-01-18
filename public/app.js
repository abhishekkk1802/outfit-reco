// API Configuration
const API_BASE_URL = window.location.origin;

// State Management
let currentBaseProduct = null;
let currentRecommendations = null;
let allProducts = [];
let isFetchingRecommendations = false;

// DOM Elements
const catalogView = document.getElementById('catalog-view');
const recommendationsView = document.getElementById('recommendations-view');
const productsGrid = document.getElementById('products-grid');
const searchInput = document.getElementById('search-input');
const roleFilter = document.getElementById('role-filter');
const backBtn = document.getElementById('back-btn');
const loading = document.getElementById('loading');
const outfitLoading = document.getElementById('outfit-loading');
const getRecommendationsBtn = document.getElementById('get-recommendations-btn');
const budgetInput = document.getElementById('budget-input');
const seasonFilter = document.getElementById('season-filter');
const occasionFilter = document.getElementById('occasion-filter');
const baseProductInfo = document.getElementById('base-product-info');
const outfitsGrid = document.getElementById('outfits-grid');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadProducts();
    setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
    searchInput.addEventListener('input', handleSearch);
    roleFilter.addEventListener('change', () => {
        // Reload products when filter changes to ensure we have the right dataset
        loadProducts();
    });
    backBtn.addEventListener('click', showCatalogView);
    getRecommendationsBtn.addEventListener('click', fetchRecommendations);
    
    // Filters (budget, season, occasion) do NOT auto-refresh
    // User must click "Get Recommendations" button to fetch new recommendations
}

// Load Products
async function loadProducts() {
    try {
        showLoading(true);
        const role = roleFilter.value;
        const url = role 
            ? `${API_BASE_URL}/products?role=${role}&limit=500`
            : `${API_BASE_URL}/products?limit=500`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        console.log(`Loaded ${data.count} products (total: ${data.total}) for role: ${role || 'all'}`);
        
        allProducts = data.products || [];
        displayProducts(allProducts);
    } catch (error) {
        console.error('Error loading products:', error);
        productsGrid.innerHTML = '<p style="color: red; text-align: center; padding: 2rem;">Error loading products. Please try again.</p>';
    } finally {
        showLoading(false);
    }
}

// Display Products
function displayProducts(products) {
    if (products.length === 0) {
        productsGrid.innerHTML = '<p style="text-align: center; padding: 2rem; color: #6B7280;">No products found.</p>';
        return;
    }

    productsGrid.innerHTML = products.map(product => `
        <div class="product-card" onclick="selectProduct('${product.sku}')">
            ${product.image 
                ? `<img src="${product.image}" alt="${product.title}" class="product-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">`
                : ''
            }
            <div class="product-image-placeholder" style="${product.image ? 'display: none;' : ''}">
                No Image Available
            </div>
            <div class="product-info">
                <div class="product-title">${escapeHtml(product.title)}</div>
                <div class="product-brand">${escapeHtml(product.brand || 'Brand N/A')}</div>
                <div class="product-price">₹${formatPrice(product.price)}</div>
                <div class="product-sku">SKU: ${product.sku}</div>
            </div>
        </div>
    `).join('');
}

// Handle Search
function handleSearch() {
    const searchTerm = searchInput.value.toLowerCase().trim();
    
    // If there's a search term, filter from allProducts
    // If no search term, the role filter change will trigger loadProducts()
    if (searchTerm) {
        const role = roleFilter.value;
        let filtered = allProducts;
        
        if (role) {
            filtered = filtered.filter(p => p.role === role);
        }
        
        filtered = filtered.filter(p => 
            p.title.toLowerCase().includes(searchTerm) ||
            p.brand?.toLowerCase().includes(searchTerm) ||
            p.sku.toLowerCase().includes(searchTerm) ||
            p.tags?.some(tag => tag.toLowerCase().includes(searchTerm))
        );
        
        displayProducts(filtered);
    }
    // If search is cleared and we have a role filter, reload products
    else if (roleFilter.value) {
        loadProducts();
    }
}

// Select Product
async function selectProduct(sku) {
    try {
        showLoading(true);
        const response = await fetch(`${API_BASE_URL}/products/${sku}`);
        if (!response.ok) {
            throw new Error('Product not found');
        }
        
        currentBaseProduct = await response.json();
        showRecommendationsView();
        
        // Auto-fetch recommendations when product is selected
        await fetchRecommendations();
    } catch (error) {
        console.error('Error loading product:', error);
        alert('Error loading product. Please try again.');
    } finally {
        showLoading(false);
    }
}

// Show Recommendations View
function showRecommendationsView() {
    if (!currentBaseProduct) return;
    
    catalogView.classList.remove('active');
    catalogView.classList.add('hidden');
    recommendationsView.classList.remove('hidden');
    recommendationsView.classList.add('active');
    
    displayBaseProductInfo();
    // Show loading placeholder while recommendations are being fetched
    outfitsGrid.innerHTML = '<div class="recommendations-placeholder"><p>Loading recommendations...</p></div>';
}

// Display Base Product Info
function displayBaseProductInfo() {
    const product = currentBaseProduct;
    baseProductInfo.innerHTML = `
        <div class="base-product-title">${escapeHtml(product.title)}</div>
        <div class="base-product-details">
            <strong>Brand:</strong> ${escapeHtml(product.brand || 'N/A')} | 
            <strong>Price:</strong> ₹${formatPrice(product.price)} | 
            <strong>SKU:</strong> ${product.sku}
        </div>
    `;
}

// Show Catalog View
function showCatalogView() {
    recommendationsView.classList.remove('active');
    recommendationsView.classList.add('hidden');
    catalogView.classList.remove('hidden');
    catalogView.classList.add('active');
    
    currentBaseProduct = null;
    currentRecommendations = null;
    // Reset filters
    budgetInput.value = '';
    seasonFilter.value = '';
    occasionFilter.value = '';
}

// Fetch Recommendations
async function fetchRecommendations() {
    if (!currentBaseProduct) return;
    
    // Prevent multiple simultaneous calls
    if (isFetchingRecommendations) {
        return;
    }
    
    try {
        isFetchingRecommendations = true;
        showOutfitLoading(true);
        
        // Disable button during fetch
        if (getRecommendationsBtn) {
            getRecommendationsBtn.disabled = true;
            getRecommendationsBtn.textContent = 'Loading...';
        }
        
        const params = new URLSearchParams({
            base_sku: currentBaseProduct.sku,
            count: 5
        });
        
        if (budgetInput.value) {
            params.append('budget', budgetInput.value);
        }
        if (seasonFilter.value) {
            params.append('season', seasonFilter.value);
        }
        if (occasionFilter.value) {
            params.append('occasion', occasionFilter.value);
        }
        
        const response = await fetch(`${API_BASE_URL}/recommendations?${params}`);
        if (!response.ok) {
            throw new Error('Failed to fetch recommendations');
        }
        
        const data = await response.json();
        currentRecommendations = data;
        
        displayAllOutfits(data);
    } catch (error) {
        console.error('Error fetching recommendations:', error);
        alert('Error fetching recommendations. Please try again.');
    } finally {
        isFetchingRecommendations = false;
        showOutfitLoading(false);
        
        // Re-enable button
        if (getRecommendationsBtn) {
            getRecommendationsBtn.disabled = false;
            getRecommendationsBtn.textContent = 'Get Recommendations';
        }
    }
}

// Display All Outfits in Grid
function displayAllOutfits(data) {
    if (!data.outfits || data.outfits.length === 0) {
        outfitsGrid.innerHTML = `
            <div class="recommendations-placeholder">
                <p>No outfit recommendations found. Try adjusting your filters.</p>
            </div>
        `;
        return;
    }
    
    outfitsGrid.innerHTML = data.outfits.map((outfit, index) => {
        const accessories = Array.isArray(outfit.accessories) ? outfit.accessories : [];
        
        // Separate base product from recommended products
        const baseProduct = { label: 'Base', product: currentBaseProduct };
        const baseSku = currentBaseProduct?.sku;
        
        // Filter out the base product from recommended products (don't show it twice)
        const recommendedProducts = [
            { label: 'Top', product: outfit.top },
            { label: 'Bottom', product: outfit.bottom },
            { label: 'Footwear', product: outfit.footwear },
            ...accessories.map((acc, idx) => ({ label: `Accessory ${idx + 1}`, product: acc }))
        ].filter(({ product }) => product && product.sku !== baseSku); // Filter out null products AND base product
        
        const aiReasoning = outfit.ai_reasoning;
        const aiStatus = outfit.ai_reasoning_status || 'pending';
        
        // Create layout: Large base image on left, product grid on right (similar to image)
        const baseHasImage = baseProduct.product?.image;
        const hasRecommendedProducts = recommendedProducts.length > 0;
        
        let imageHTML = '';
        if (baseHasImage || hasRecommendedProducts) {
            imageHTML = `
                <div class="outfit-card-layout-model">
                    <div class="outfit-model-section">
                        ${baseHasImage 
                            ? `<img src="${baseProduct.product.image}" alt="Base Product" class="outfit-model-image" onerror="this.style.display='none'; this.parentElement.innerHTML='<div class=\\'outfit-image-placeholder-large\\'><p>Base Product</p></div>';">`
                            : `<div class="outfit-image-placeholder-large"><p>Base Product</p></div>`
                        }
                    </div>
                    <div class="outfit-products-grid-section">
                        ${recommendedProducts.length > 0
                            ? recommendedProducts.map(({ label, product }) => `
                                <div class="outfit-product-grid-item">
                                    ${product.image 
                                        ? `<div class="product-grid-image-wrapper">
                                            <img src="${product.image}" alt="${escapeHtml(product.title || label)}" class="product-grid-image" loading="lazy" onerror="this.onerror=null; this.style.display='none'; this.parentElement.innerHTML='<div class=\\'product-grid-placeholder\\'><p>No Image</p></div>';">
                                           </div>`
                                        : `<div class="product-grid-placeholder"><p>No Image</p></div>`
                                    }
                                    <div class="product-grid-info">
                                        <div class="product-grid-name">${escapeHtml(product.title || label)}</div>
                                        <div class="product-grid-price">₹${formatPrice(product.price || 0)}</div>
                                    </div>
                                </div>
                            `).join('')
                            : '<div class="outfit-no-products"><p>No recommended products</p></div>'
                        }
                    </div>
                </div>
            `;
        } else {
            // No images available
            imageHTML = `
                <div class="outfit-card-image-placeholder">
                    <p>Outfit ${index + 1}</p>
                </div>
            `;
        }
        
        return `
            <div class="outfit-card">
                <div class="outfit-card-header">
                    <div class="outfit-number">Outfit ${index + 1}</div>
                    ${outfit.match_score !== undefined 
                        ? `<span class="match-score-small">${(outfit.match_score * 100).toFixed(0)}% Match</span>` 
                        : ''
                    }
                </div>
                
                ${imageHTML}
                
                <div class="outfit-card-body">
                    <div class="outfit-card-price">Total: ₹${formatPrice(outfit.total_price || 0)}</div>
                    
                    <div class="outfit-card-products">
                        ${allProducts.filter(({ product }) => product).map(({ label, product }) => `
                            <div class="outfit-card-product-item">
                                <span class="product-label">${label}:</span>
                                <span class="product-name">${escapeHtml(product.title)}</span>
                                <span class="product-price">₹${formatPrice(product.price)}</span>
                            </div>
                        `).join('')}
                    </div>
                    
                    ${aiReasoning 
                        ? `<div class="outfit-card-ai">
                            <span class="ai-status-badge ${aiStatus}">AI ${aiStatus === 'ready' ? 'Ready' : 'Pending'}</span>
                            ${aiReasoning.paragraph 
                                ? `<p class="ai-paragraph-small">${escapeHtml(aiReasoning.paragraph.substring(0, 150))}${aiReasoning.paragraph.length > 150 ? '...' : ''}</p>` 
                                : ''
                            }
                        </div>`
                        : aiStatus === 'pending'
                            ? `<div class="outfit-card-ai">
                                <span class="ai-status-badge pending">AI Pending</span>
                                <p class="ai-paragraph-small">AI explanation is being generated...</p>
                            </div>`
                            : ''
                    }
                </div>
            </div>
        `;
    }).join('');
}


// Utility Functions
function showLoading(show) {
    if (show) {
        loading.classList.remove('hidden');
    } else {
        loading.classList.add('hidden');
    }
}

function showOutfitLoading(show) {
    if (show) {
        outfitLoading.classList.remove('hidden');
    } else {
        outfitLoading.classList.add('hidden');
    }
}

function formatPrice(price) {
    if (!price) return '0';
    return new Intl.NumberFormat('en-IN').format(price);
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Make selectProduct available globally
window.selectProduct = selectProduct;

