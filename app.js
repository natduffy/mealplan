// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyDjEzB-bVW0GV_mCPBWQM3gAE9mMpsWm4o",
    authDomain: "mealplanner-69e8e.firebaseapp.com",
    databaseURL: "https://mealplanner-69e8e-default-rtdb.firebaseio.com",
    projectId: "mealplanner-69e8e",
    storageBucket: "mealplanner-69e8e.firebasestorage.app",
    messagingSenderId: "1084224276681",
    appId: "1:1084224276681:web:093907134347cff547e518"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();
const mealPlanRef = database.ref('mealPlan');

// Meal concepts organized by protein category
const mealConcepts = {
    chicken: [
        "chicken and squash",
        "chicken stir-fry with vegetables",
        "chicken tacos",
        "roasted chicken with root vegetables",
        "chicken noodle soup",
        "chicken fajitas",
        "chicken curry",
        "grilled chicken thighs with salad",
        "chicken and rice bowl",
        "sheet-pan chicken with peppers",
        "chicken marbella",
        "chicken salad wraps",
        "lemon herb chicken",
        "chicken and mushrooms",
        "teriyaki chicken bowl",
        "chicken parmesan",
        "orange chicken with broccoli",
        "chicken gumbo",
        "tom kha gai",
        "chicken and apple salad"
    ],
    fish: [
        "fish and peppers",
        "fish with tomatoes and olives",
        "salmon and broccoli",
        "fish tacos",
        "tuna casserole with white beans",
        "crispy baked fish with tartar sauce",
        "sheet-pan roasted fish with vegetables",
        "fish and couscous",
        "miso-glazed salmon",
        "shrimp stir-fry",
        "shrimp and bean stew",
        "linguine with shrimp",
        "fish sandwiches",
        "fish curry",
        "pan-seared fish with lemon",
        "fish and chips",
        "seafood pasta"
    ],
    pork: [
        "pork chops and apples",
        "pulled pork tacos",
        "pork stir-fry",
        "pork schnitzel with pickles",
        "hoisin pork bowl",
        "moo shu pork",
        "pork and cabbage",
        "pork tenderloin with roasted vegetables",
        "sausage with peppers and onions",
        "slow cooker pork",
        "pork fried rice",
        "pork and squash stew",
        "coconut pork curry",
        "pork and bean soup",
        "Italian sausage pasta"
    ],
    beef: [
        "beef stew",
        "burgers",
        "meatballs and pasta",
        "beef tacos",
        "salisbury steak",
        "beef and broccoli",
        "sloppy joes",
        "beef chili",
        "meatloaf with vegetables",
        "beef stir-fry",
        "beef and mushroom stroganoff",
        "Korean beef bowl",
        "Swedish meatballs",
        "beef and vegetable soup",
        "stuffed peppers"
    ],
    vegetarian: [
        "grilled cheese and soup",
        "pasta primavera",
        "chickpea salad",
        "lentil soup",
        "bean and vegetable stew",
        "spinach and feta pasta",
        "dal with rice",
        "vegetable curry",
        "black bean tacos",
        "red beans and rice",
        "white bean and kale soup",
        "mushroom risotto",
        "spanakopita",
        "veggie stir-fry with tofu",
        "polenta with roasted vegetables",
        "minestrone soup",
        "falafel bowls",
        "stuffed squash"
    ]
};

// All 7 days of the week
const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// State
let mealPlan = [];
let draggedItem = null;
let draggedIndex = null;
let editingDay = null;
let isInitialized = false;

// Utility functions
function shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function getRandomItems(array, count) {
    return shuffle(array).slice(0, count);
}

// Firebase sync functions
function savePlanToFirebase() {
    // Convert array to object keyed by day for easier Firebase updates
    const planData = {};
    mealPlan.forEach(meal => {
        planData[meal.day] = {
            meal: meal.meal,
            category: meal.category,
            approved: meal.approved
        };
    });
    mealPlanRef.set(planData);
}

function loadPlanFromFirebase(snapshot) {
    const data = snapshot.val();
    if (data) {
        mealPlan = [];
        days.forEach(day => {
            if (data[day]) {
                mealPlan.push({
                    day: day,
                    meal: data[day].meal,
                    category: data[day].category,
                    approved: data[day].approved || false
                });
            }
        });
    }
    return mealPlan.length > 0;
}

// Generate a 7-day meal plan with protein pairing
function generateMealPlan(preserveApproved = false) {
    const approvedMeals = preserveApproved 
        ? mealPlan.filter(m => m.approved) 
        : [];
    
    const approvedDays = new Set(approvedMeals.map(m => m.day));
    const daysToFill = days.filter(d => !approvedDays.has(d));
    const numMealsNeeded = daysToFill.length;
    
    if (numMealsNeeded === 0) {
        return mealPlan;
    }
    
    // Pick 3-4 protein categories for a full week
    const categories = Object.keys(mealConcepts);
    const numCategories = numMealsNeeded <= 3 ? 2 : (numMealsNeeded <= 5 ? 3 : 4);
    const selectedCategories = getRandomItems(categories, numCategories);
    
    // Distribute meals across categories
    const distribution = [];
    let remaining = numMealsNeeded;
    
    for (let i = 0; i < selectedCategories.length; i++) {
        if (i === selectedCategories.length - 1) {
            distribution.push(remaining);
        } else {
            const avg = Math.ceil(remaining / (selectedCategories.length - i));
            const count = Math.min(avg, remaining - (selectedCategories.length - i - 1));
            distribution.push(count);
            remaining -= count;
        }
    }
    
    // Get meals from each category
    let newMeals = [];
    selectedCategories.forEach((category, i) => {
        const categoryMeals = getRandomItems(mealConcepts[category], distribution[i]);
        categoryMeals.forEach(meal => {
            newMeals.push({ meal, category });
        });
    });
    
    // Shuffle to avoid back-to-back same proteins
    newMeals = shuffleAvoidingRepeats(newMeals);
    
    // Assign to days
    const result = [...approvedMeals];
    daysToFill.forEach((day, i) => {
        result.push({
            day,
            meal: newMeals[i].meal,
            category: newMeals[i].category,
            approved: false
        });
    });
    
    // Sort by day order
    result.sort((a, b) => days.indexOf(a.day) - days.indexOf(b.day));
    
    return result;
}

// Shuffle meals while avoiding back-to-back same categories
function shuffleAvoidingRepeats(meals) {
    if (meals.length <= 1) return meals;
    
    // Try up to 50 times to get a good shuffle
    for (let attempt = 0; attempt < 50; attempt++) {
        const shuffled = shuffle(meals);
        let hasRepeat = false;
        
        for (let i = 1; i < shuffled.length; i++) {
            if (shuffled[i].category === shuffled[i - 1].category) {
                hasRepeat = true;
                break;
            }
        }
        
        if (!hasRepeat) return shuffled;
    }
    
    // If we can't avoid repeats, just return a shuffle
    return shuffle(meals);
}

// Generate a single new meal for a specific day
function generateSingleMeal(day) {
    // Get categories already in use (excluding this day)
    const otherMeals = mealPlan.filter(m => m.day !== day);
    const usedCategories = [...new Set(otherMeals.map(m => m.category))];
    
    // Prefer categories already in use for shopping efficiency
    let category;
    if (usedCategories.length > 0 && Math.random() < 0.7) {
        category = usedCategories[Math.floor(Math.random() * usedCategories.length)];
    } else {
        const categories = Object.keys(mealConcepts);
        category = categories[Math.floor(Math.random() * categories.length)];
    }
    
    // Avoid same meal as adjacent days
    const dayIndex = days.indexOf(day);
    const adjacentMeals = otherMeals
        .filter(m => Math.abs(days.indexOf(m.day) - dayIndex) === 1)
        .map(m => m.category);
    
    // If adjacent days have same category, try a different one
    if (adjacentMeals.includes(category) && Math.random() < 0.8) {
        const otherCategories = Object.keys(mealConcepts).filter(c => !adjacentMeals.includes(c));
        if (otherCategories.length > 0) {
            category = otherCategories[Math.floor(Math.random() * otherCategories.length)];
        }
    }
    
    const meal = mealConcepts[category][Math.floor(Math.random() * mealConcepts[category].length)];
    
    return { day, meal, category, approved: false };
}

// Render the meal plan
function render() {
    const list = document.getElementById('meal-list');
    list.innerHTML = '';
    
    days.forEach((day, index) => {
        const mealData = mealPlan.find(m => m.day === day);
        const isEditing = editingDay === day;
        const li = document.createElement('li');
        li.className = 'meal-card' + (mealData?.approved ? ' approved' : '') + (!mealData ? ' empty' : '') + (isEditing ? ' editing' : '');
        li.dataset.day = day;
        li.dataset.index = index;
        
        if (mealData) {
            li.draggable = !isEditing;
            
            if (isEditing) {
                li.innerHTML = `
                    <div class="drag-handle" style="visibility: hidden;">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <span class="day-label">${day.slice(0, 3)}</span>
                    <input type="text" class="meal-input" value="${mealData.meal}" data-day="${day}" placeholder="Enter meal...">
                    <div class="meal-actions">
                        <button class="btn btn-action btn-save" data-day="${day}" title="Save">✓</button>
                        <button class="btn btn-action btn-cancel" data-day="${day}" title="Cancel">×</button>
                    </div>
                `;
            } else {
                li.innerHTML = `
                    <div class="drag-handle" title="Drag to reorder">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <span class="day-label">${day.slice(0, 3)}</span>
                    <span class="meal-content">${mealData.meal}</span>
                    <div class="meal-actions">
                        <button class="btn btn-action btn-edit" data-day="${day}" title="Edit">✎</button>
                        <button class="btn btn-action btn-approve" data-day="${day}" title="${mealData.approved ? 'Unlock' : 'Approve'}">
                            ${mealData.approved ? '✓' : '○'}
                        </button>
                        <button class="btn btn-action btn-delete" data-day="${day}" title="Delete">×</button>
                    </div>
                `;
            }
            
            // Add drag event listeners (only when not editing)
            if (!isEditing) {
                li.addEventListener('dragstart', handleDragStart);
                li.addEventListener('dragend', handleDragEnd);
                li.addEventListener('dragover', handleDragOver);
                li.addEventListener('dragenter', handleDragEnter);
                li.addEventListener('dragleave', handleDragLeave);
                li.addEventListener('drop', handleDrop);
            }
        } else {
            // Empty slot - show input for manual entry
            if (isEditing) {
                li.innerHTML = `
                    <div class="drag-handle" style="visibility: hidden;">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <span class="day-label">${day.slice(0, 3)}</span>
                    <input type="text" class="meal-input" value="" data-day="${day}" placeholder="Enter meal...">
                    <div class="meal-actions">
                        <button class="btn btn-action btn-save" data-day="${day}" title="Save">✓</button>
                        <button class="btn btn-action btn-cancel" data-day="${day}" title="Cancel">×</button>
                    </div>
                `;
            } else {
                li.innerHTML = `
                    <div class="drag-handle" style="visibility: hidden;">
                        <span></span>
                        <span></span>
                        <span></span>
                    </div>
                    <span class="day-label">${day.slice(0, 3)}</span>
                    <span class="meal-content">No meal planned</span>
                    <div class="meal-actions">
                        <button class="btn btn-action btn-edit" data-day="${day}" title="Add">+</button>
                        <button class="btn btn-regenerate" data-day="${day}">Generate</button>
                    </div>
                `;
            }
        }
        
        list.appendChild(li);
    });
    
    // Focus input if editing
    if (editingDay) {
        const input = document.querySelector('.meal-input');
        if (input) {
            input.focus();
            input.select();
        }
    }
}

// Drag and Drop handlers
function handleDragStart(e) {
    draggedItem = this;
    draggedIndex = parseInt(this.dataset.index);
    
    // Set drag data
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', this.dataset.day);
    
    // Add visual feedback
    setTimeout(() => {
        this.classList.add('dragging');
    }, 0);
}

function handleDragEnd(e) {
    this.classList.remove('dragging');
    
    // Remove drag-over class from all items
    document.querySelectorAll('.meal-card').forEach(card => {
        card.classList.remove('drag-over');
    });
    
    draggedItem = null;
    draggedIndex = null;
}

function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function handleDragEnter(e) {
    e.preventDefault();
    if (this !== draggedItem && !this.classList.contains('empty')) {
        this.classList.add('drag-over');
    }
}

function handleDragLeave(e) {
    this.classList.remove('drag-over');
}

function handleDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    
    this.classList.remove('drag-over');
    
    if (this === draggedItem || this.classList.contains('empty')) {
        return;
    }
    
    const fromDay = e.dataTransfer.getData('text/plain');
    const toDay = this.dataset.day;
    
    if (fromDay && toDay && fromDay !== toDay) {
        swapMeals(fromDay, toDay);
    }
}

// Swap meals between two days
function swapMeals(fromDay, toDay) {
    const fromMeal = mealPlan.find(m => m.day === fromDay);
    const toMeal = mealPlan.find(m => m.day === toDay);
    
    if (fromMeal && toMeal) {
        // Swap the days
        fromMeal.day = toDay;
        toMeal.day = fromDay;
        
        // Re-sort by day order
        mealPlan.sort((a, b) => days.indexOf(a.day) - days.indexOf(b.day));
        
        savePlanToFirebase();
        render();
    }
}

// Event handlers
function handleApprove(day) {
    const meal = mealPlan.find(m => m.day === day);
    if (meal) {
        meal.approved = !meal.approved;
        savePlanToFirebase();
        render();
    }
}

function handleDelete(day) {
    mealPlan = mealPlan.filter(m => m.day !== day);
    savePlanToFirebase();
    render();
}

function handleRegenerate(day) {
    const newMeal = generateSingleMeal(day);
    mealPlan = mealPlan.filter(m => m.day !== day);
    mealPlan.push(newMeal);
    mealPlan.sort((a, b) => days.indexOf(a.day) - days.indexOf(b.day));
    
    savePlanToFirebase();
    
    // Add animation class briefly
    render();
    const card = document.querySelector(`[data-day="${day}"]`);
    if (card) {
        card.classList.add('new');
        setTimeout(() => card.classList.remove('new'), 300);
    }
}

function handleShuffleAll() {
    mealPlan = generateMealPlan(true); // Preserve approved meals
    savePlanToFirebase();
    render();
}

function handleEdit(day) {
    editingDay = day;
    render();
}

function handleSave(day) {
    const input = document.querySelector(`.meal-input[data-day="${day}"]`);
    if (!input) return;
    
    const value = input.value.trim();
    if (value) {
        // Update or create the meal
        const existingMeal = mealPlan.find(m => m.day === day);
        if (existingMeal) {
            existingMeal.meal = value;
            existingMeal.category = 'custom'; // Mark as manually entered
        } else {
            mealPlan.push({
                day,
                meal: value,
                category: 'custom',
                approved: false
            });
            mealPlan.sort((a, b) => days.indexOf(a.day) - days.indexOf(b.day));
        }
        savePlanToFirebase();
    }
    
    editingDay = null;
    render();
}

function handleCancelEdit() {
    editingDay = null;
    render();
}

// Event delegation for buttons
document.getElementById('meal-list').addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    
    const day = btn.dataset.day;
    
    if (btn.classList.contains('btn-approve')) {
        handleApprove(day);
    } else if (btn.classList.contains('btn-delete')) {
        handleDelete(day);
    } else if (btn.classList.contains('btn-regenerate')) {
        handleRegenerate(day);
    } else if (btn.classList.contains('btn-edit')) {
        handleEdit(day);
    } else if (btn.classList.contains('btn-save')) {
        handleSave(day);
    } else if (btn.classList.contains('btn-cancel')) {
        handleCancelEdit();
    }
});

// Handle Enter key to save, Escape to cancel
document.getElementById('meal-list').addEventListener('keydown', (e) => {
    if (e.target.classList.contains('meal-input')) {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSave(e.target.dataset.day);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            handleCancelEdit();
        }
    }
});

document.getElementById('shuffle-all').addEventListener('click', handleShuffleAll);

// Initialize with Firebase real-time listener
mealPlanRef.on('value', (snapshot) => {
    const hadData = loadPlanFromFirebase(snapshot);
    
    if (!isInitialized) {
        isInitialized = true;
        if (!hadData) {
            // No existing data - generate a fresh plan
            mealPlan = generateMealPlan();
            savePlanToFirebase();
        }
    }
    
    // Only re-render if we're not in the middle of editing
    if (!editingDay) {
        render();
    }
});
