// ========== ИНИЦИАЛИЗАЦИЯ ==========
let autoSaveTimeout;
let currentTemplate = 'classic';
let currentColorScheme = 'blue';
let currentVersion = 'current';
const STORAGE_KEY = 'cv_creator_data';
const VERSIONS_KEY = 'cv_creator_versions';
const THEME_KEY = 'cv_creator_theme';
const TEMPLATE_KEY = 'cv_creator_template';
const COLOR_SCHEME_KEY = 'cv_creator_color_scheme';

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', function() {
    initTheme();
    initTemplate();
    initVersions();
    loadSavedData();
    setupAutoSave();
    setupEventListeners();
    updateProgress();
    initDragAndDrop();
    initCharCounters();
    initTooltips();
    
    // Обработчик клика на preview для загрузки фото
    const photoPreview = document.getElementById('photoPreview');
    const photoUpload = document.getElementById('photoUpload');
    if (photoPreview && photoUpload) {
        photoPreview.addEventListener('click', function() {
            photoUpload.click();
        });
    }
    
    // Подавление ошибок от расширений браузера
    window.addEventListener('error', function(e) {
        if (e.message && e.message.includes('content-script')) {
            e.preventDefault();
            return false;
        }
    }, true);
});

// Настройка обработчиков событий
function setupEventListeners() {
    document.getElementById('cvForm').addEventListener('submit', function(e) {
        e.preventDefault();
        if (validateForm()) {
            generateCV();
            showNotification('Резюме успешно создано!', 'success');
        }
    });

    // Автоматическое обновление предпросмотра и автосохранение
    document.getElementById('cvForm').addEventListener('input', function(e) {
        // Валидация в реальном времени
        validateField(e.target);
        
        clearTimeout(autoSaveTimeout);
        autoSaveTimeout = setTimeout(() => {
            generateCV();
            saveToLocalStorage();
            updateProgress();
        }, 1000);
    });

    // Валидация при потере фокуса
    document.getElementById('cvForm').addEventListener('blur', function(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
            validateField(e.target);
        }
    }, true);

    // Обработка чекбоксов "По настоящее время"
    document.addEventListener('change', function(e) {
        if (e.target.classList.contains('exp-current')) {
            const endDateInput = e.target.closest('.experience-item').querySelector('.exp-end');
            endDateInput.disabled = e.target.checked;
            if (e.target.checked) {
                endDateInput.value = '';
            }
            generateCV();
            saveToLocalStorage();
        }
    });
}

// ========== ВАЛИДАЦИЯ ==========
function validateField(field) {
    const fieldId = field.id || field.className;
    let errorElement = field.parentElement.querySelector('.field-error');
    let successElement = field.parentElement.querySelector('.field-success');
    
    if (!errorElement) {
        errorElement = document.createElement('div');
        errorElement.className = 'field-error';
        field.parentElement.appendChild(errorElement);
    }
    
    if (!successElement) {
        successElement = document.createElement('div');
        successElement.className = 'field-success';
        field.parentElement.appendChild(successElement);
    }
    
    // Очищаем предыдущие сообщения
    errorElement.classList.remove('show');
    successElement.classList.remove('show');
    
    // Валидация email
    if (field.type === 'email' && field.value) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(field.value)) {
            errorElement.textContent = 'Введите корректный email адрес';
            errorElement.classList.add('show');
            field.setCustomValidity('Некорректный email');
            return false;
        } else {
            field.setCustomValidity('');
            successElement.textContent = '✓ Корректный email';
            successElement.classList.add('show');
        }
    }
    
    // Валидация URL
    if (field.type === 'url' && field.value) {
        try {
            new URL(field.value);
            field.setCustomValidity('');
            successElement.textContent = '✓ Корректная ссылка';
            successElement.classList.add('show');
        } catch (e) {
            errorElement.textContent = 'Введите корректную ссылку (начинается с http:// или https://)';
            errorElement.classList.add('show');
            field.setCustomValidity('Некорректная ссылка');
            return false;
        }
    }
    
    // Валидация телефона
    if (field.type === 'tel' && field.value) {
        const phoneRegex = /^[\d\s\-\+\(\)]+$/;
        if (!phoneRegex.test(field.value) || field.value.replace(/\D/g, '').length < 10) {
            errorElement.textContent = 'Введите корректный номер телефона';
            errorElement.classList.add('show');
            field.setCustomValidity('Некорректный телефон');
            return false;
        } else {
            field.setCustomValidity('');
            successElement.textContent = '✓ Корректный телефон';
            successElement.classList.add('show');
        }
    }
    
    // Валидация обязательных полей
    if (field.hasAttribute('required') && !field.value.trim()) {
        errorElement.textContent = 'Это поле обязательно для заполнения';
        errorElement.classList.add('show');
        return false;
    }
    
    // Валидация дат
    if (field.type === 'month' && field.value) {
        const selectedDate = new Date(field.value + '-01');
        const today = new Date();
        
        // Проверка на будущую дату для даты начала
        if (field.classList.contains('exp-start') || field.classList.contains('edu-start')) {
            if (selectedDate > today) {
                errorElement.textContent = 'Дата не может быть в будущем';
                errorElement.classList.add('show');
                return false;
            }
        }
        
        // Проверка даты окончания должна быть после даты начала
        if (field.classList.contains('exp-end')) {
            const startField = field.closest('.experience-item').querySelector('.exp-start');
            if (startField && startField.value) {
                const startDate = new Date(startField.value + '-01');
                if (selectedDate < startDate) {
                    errorElement.textContent = 'Дата окончания должна быть после даты начала';
                    errorElement.classList.add('show');
                    return false;
                }
            }
        }
    }
    
    // Если все проверки пройдены
    if (field.value && !field.validity.customError) {
        field.setCustomValidity('');
    }
    
    return true;
}

function validateForm() {
    const form = document.getElementById('cvForm');
    const requiredFields = form.querySelectorAll('[required]');
    let isValid = true;
    const errors = [];
    
    // Проверка обязательных полей
    requiredFields.forEach(field => {
        if (!validateField(field)) {
            isValid = false;
            if (field.id) {
                errors.push(field.previousElementSibling?.textContent || field.id);
            }
        }
    });
    
    // Проверка опыта работы
    const experienceItems = document.querySelectorAll('.experience-item');
    experienceItems.forEach((item, index) => {
        const position = item.querySelector('.exp-position')?.value;
        const company = item.querySelector('.exp-company')?.value;
        const start = item.querySelector('.exp-start')?.value;
        
        if (!position || !company || !start) {
            isValid = false;
            errors.push(`Опыт работы #${index + 1} - заполните все обязательные поля`);
        }
    });
    
    // Проверка образования
    const educationItems = document.querySelectorAll('.education-item');
    educationItems.forEach((item, index) => {
        const school = item.querySelector('.edu-school')?.value;
        const degree = item.querySelector('.edu-degree')?.value;
        
        if (!school || !degree) {
            isValid = false;
            errors.push(`Образование #${index + 1} - заполните все обязательные поля`);
        }
    });
    
    // Проверка языков
    const languageItems = document.querySelectorAll('.language-item');
    languageItems.forEach((item, index) => {
        const name = item.querySelector('.lang-name')?.value;
        const level = item.querySelector('.lang-level')?.value;
        
        if (!name || !level) {
            isValid = false;
            errors.push(`Язык #${index + 1} - заполните все поля`);
        }
    });
    
    if (!isValid) {
        showNotification('Пожалуйста, заполните все обязательные поля корректно', 'error');
        console.log('Ошибки валидации:', errors);
    }
    
    return isValid;
}

// ========== ТЕМНАЯ ТЕМА ==========
function initTheme() {
    const savedTheme = localStorage.getItem(THEME_KEY) || 'light';
    setTheme(savedTheme);
    
    document.getElementById('themeToggle').addEventListener('click', function() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        setTheme(newTheme);
    });
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    const themeIcon = document.querySelector('.theme-icon');
    if (themeIcon) {
        themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
}

// ========== ШАБЛОНЫ РЕЗЮМЕ ==========
function initTemplate() {
    const savedTemplate = localStorage.getItem(TEMPLATE_KEY) || 'classic';
    currentTemplate = savedTemplate;
    const templateSelect = document.getElementById('templateSelect');
    if (templateSelect) {
        templateSelect.value = savedTemplate;
    }
    applyTemplate(savedTemplate);
    
    // Инициализация цветовой схемы
    const savedColorScheme = localStorage.getItem(COLOR_SCHEME_KEY) || 'blue';
    currentColorScheme = savedColorScheme;
    const colorSchemeSelect = document.getElementById('colorSchemeSelect');
    if (colorSchemeSelect) {
        colorSchemeSelect.value = savedColorScheme;
    }
    applyColorScheme(savedColorScheme);
}

function changeTemplate(template) {
    currentTemplate = template;
    localStorage.setItem(TEMPLATE_KEY, template);
    applyTemplate(template);
    generateCV(); // Перегенерируем резюме с новым шаблоном
    showNotification(`Шаблон изменен на: ${getTemplateName(template)}`, 'success');
}

function applyTemplate(template) {
    const cvContent = document.querySelector('.cv-content');
    if (cvContent) {
        // Удаляем все классы шаблонов
        cvContent.classList.remove('template-classic', 'template-modern', 'template-minimal');
        // Добавляем новый класс шаблона
        cvContent.classList.add(`template-${template}`);
    }
}

function getTemplateName(template) {
    const names = {
        'classic': 'Классический',
        'modern': 'Современный',
        'minimal': 'Минималистичный'
    };
    return names[template] || template;
}

// ========== ЦВЕТОВЫЕ СХЕМЫ ==========
function changeColorScheme(scheme) {
    currentColorScheme = scheme;
    localStorage.setItem(COLOR_SCHEME_KEY, scheme);
    applyColorScheme(scheme);
    generateCV(); // Перегенерируем резюме с новой цветовой схемой
    showNotification(`Цветовая схема изменена`, 'success');
}

function applyColorScheme(scheme) {
    const cvContent = document.querySelector('.cv-content');
    if (cvContent) {
        // Удаляем все классы цветовых схем
        cvContent.classList.remove('color-blue', 'color-green', 'color-purple', 'color-red', 'color-orange', 'color-teal');
        // Добавляем новый класс цветовой схемы
        cvContent.classList.add(`color-${scheme}`);
    }
}

// ========== АВТОСОХРАНЕНИЕ ==========
function saveToLocalStorage() {
    const data = collectFormData();
    const versions = getVersions();
    
    // Сохраняем в текущую версию
    versions[currentVersion] = {
        data: data,
        template: currentTemplate,
        colorScheme: currentColorScheme,
        savedAt: new Date().toISOString()
    };
    
    saveVersions(versions);
}

function loadSavedData() {
    const versions = getVersions();
    const saved = versions[currentVersion] || versions['current'];
    
    if (saved && saved.data) {
        try {
            populateForm(saved.data);
            if (saved.template) {
                currentTemplate = saved.template;
                const templateSelect = document.getElementById('templateSelect');
                if (templateSelect) templateSelect.value = saved.template;
                applyTemplate(saved.template);
            }
            if (saved.colorScheme) {
                currentColorScheme = saved.colorScheme;
                const colorSchemeSelect = document.getElementById('colorSchemeSelect');
                if (colorSchemeSelect) colorSchemeSelect.value = saved.colorScheme;
                applyColorScheme(saved.colorScheme);
            }
            generateCV();
            showNotification('Данные загружены', 'info');
        } catch (e) {
            console.error('Ошибка загрузки данных:', e);
        }
    }
}

// ========== УПРАВЛЕНИЕ ВЕРСИЯМИ ==========
function getVersions() {
    const versionsJson = localStorage.getItem(VERSIONS_KEY);
    return versionsJson ? JSON.parse(versionsJson) : {};
}

function saveVersions(versions) {
    localStorage.setItem(VERSIONS_KEY, JSON.stringify(versions));
}

function initVersions() {
    const versions = getVersions();
    const versionSelect = document.getElementById('versionSelect');
    if (!versionSelect) return;
    
    // Очищаем список версий (кроме "Текущая")
    while (versionSelect.children.length > 1) {
        versionSelect.removeChild(versionSelect.lastChild);
    }
    
    // Добавляем сохраненные версии
    Object.keys(versions).forEach(versionName => {
        if (versionName !== 'current') {
            const option = document.createElement('option');
            option.value = versionName;
            option.textContent = versionName;
            versionSelect.appendChild(option);
        }
    });
}

function saveNewVersion() {
    const versionName = prompt('Введите название версии:', `Версия ${new Date().toLocaleDateString()}`);
    if (!versionName || versionName.trim() === '') {
        return;
    }
    
    const versions = getVersions();
    const currentData = collectFormData();
    
    versions[versionName] = {
        data: currentData,
        template: currentTemplate,
        colorScheme: currentColorScheme,
        savedAt: new Date().toISOString()
    };
    
    saveVersions(versions);
    initVersions();
    showNotification(`Версия "${versionName}" сохранена`, 'success');
}

function loadVersion(versionName) {
    if (versionName === 'current') {
        currentVersion = 'current';
        loadSavedData();
        return;
    }
    
    const versions = getVersions();
    const version = versions[versionName];
    
    if (!version) {
        showNotification('Версия не найдена', 'error');
        return;
    }
    
    if (confirm(`Загрузить версию "${versionName}"? Текущие несохраненные изменения будут потеряны.`)) {
        currentVersion = versionName;
        populateForm(version.data);
        if (version.template) {
            currentTemplate = version.template;
            const templateSelect = document.getElementById('templateSelect');
            if (templateSelect) templateSelect.value = version.template;
            applyTemplate(version.template);
        }
        if (version.colorScheme) {
            currentColorScheme = version.colorScheme;
            const colorSchemeSelect = document.getElementById('colorSchemeSelect');
            if (colorSchemeSelect) colorSchemeSelect.value = version.colorScheme;
            applyColorScheme(version.colorScheme);
        }
        generateCV();
        updateProgress();
        showNotification(`Версия "${versionName}" загружена`, 'success');
    } else {
        document.getElementById('versionSelect').value = currentVersion;
    }
}

function deleteVersion() {
    const versionSelect = document.getElementById('versionSelect');
    const selectedVersion = versionSelect.value;
    
    if (selectedVersion === 'current') {
        showNotification('Нельзя удалить текущую версию', 'error');
        return;
    }
    
    if (confirm(`Удалить версию "${selectedVersion}"?`)) {
        const versions = getVersions();
        delete versions[selectedVersion];
        saveVersions(versions);
        initVersions();
        versionSelect.value = 'current';
        currentVersion = 'current';
        showNotification(`Версия "${selectedVersion}" удалена`, 'success');
    }
}

function setupAutoSave() {
    // Автосохранение каждые 30 секунд
    setInterval(() => {
        saveToLocalStorage();
    }, 30000);
}

// ========== УВЕДОМЛЕНИЯ ==========
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type} show`;
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// ========== ПРОГРЕСС ЗАПОЛНЕНИЯ ==========
function updateProgress() {
    const data = collectFormData();
    let filled = 0;
    let total = 0;
    
    // Личная информация (4 обязательных поля)
    total += 4;
    if (data.firstName) filled++;
    if (data.lastName) filled++;
    if (data.email) filled++;
    if (data.phone) filled++;
    
    // О себе
    total += 1;
    if (data.summary) filled++;
    
    // Опыт работы
    total += 1;
    if (data.experience.length > 0) filled++;
    
    // Образование
    total += 1;
    if (data.education.length > 0) filled++;
    
    // Навыки
    total += 1;
    if (data.skills.length > 0) filled++;
    
    // Языки
    total += 1;
    if (data.languages.length > 0) filled++;
    
    // Проекты
    total += 1;
    if (data.projects && data.projects.length > 0) filled++;
    
    // Сертификаты
    total += 1;
    if (data.certificates && data.certificates.length > 0) filled++;
    
    const percentage = Math.round((filled / total) * 100);
    document.getElementById('progressFill').style.width = percentage + '%';
    document.getElementById('progressText').textContent = percentage + '% заполнено';
}

// Добавление опыта работы
function addExperience() {
    const container = document.getElementById('experienceContainer');
    const newItem = document.createElement('div');
    newItem.className = 'experience-item draggable';
    newItem.draggable = true;
    newItem.innerHTML = `
        <div class="drag-handle" title="Перетащите для изменения порядка">⋮⋮</div>
        <div class="form-row">
            <div class="form-field">
                <label>Должность *</label>
                <input type="text" class="exp-position" required>
            </div>
            <div class="form-field">
                <label>Компания *</label>
                <input type="text" class="exp-company" required>
            </div>
        </div>
        <div class="form-row">
            <div class="form-field">
                <label>Дата начала *</label>
                <input type="month" class="exp-start" required>
            </div>
            <div class="form-field">
                <label>Дата окончания</label>
                <input type="month" class="exp-end">
                <label class="checkbox-label">
                    <input type="checkbox" class="exp-current"> По настоящее время
                </label>
            </div>
        </div>
        <div class="form-field">
            <label>
                Описание
                <span class="char-counter exp-desc-counter">0 / 1000</span>
            </label>
            <textarea class="exp-description" rows="3" placeholder="Опишите ваши обязанности и достижения..." maxlength="1000" oninput="updateCharCounterForElement(this, 1000)"></textarea>
        </div>
        <button type="button" class="btn-remove" onclick="removeExperience(this)">Удалить</button>
    `;
    container.appendChild(newItem);
    
    // Настройка Drag & Drop
    setupDragAndDrop(newItem, container);
    
    // Обработка чекбокса "По настоящее время"
    const currentCheckbox = newItem.querySelector('.exp-current');
    const endDateInput = newItem.querySelector('.exp-end');
    currentCheckbox.addEventListener('change', function() {
        endDateInput.disabled = this.checked;
        if (this.checked) {
            endDateInput.value = '';
        }
        generateCV();
        saveToLocalStorage();
        updateProgress();
    });
    
    generateCV();
    saveToLocalStorage();
    updateProgress();
}

// Удаление опыта работы
function removeExperience(button) {
    const container = document.getElementById('experienceContainer');
    if (container.children.length > 1) {
        button.parentElement.remove();
        generateCV();
        saveToLocalStorage();
        updateProgress();
    } else {
        showNotification('Должен быть хотя бы один пункт опыта работы', 'error');
    }
}

// Добавление образования
function addEducation() {
    const container = document.getElementById('educationContainer');
    const newItem = document.createElement('div');
    newItem.className = 'education-item draggable';
    newItem.draggable = true;
    newItem.innerHTML = `
        <div class="drag-handle" title="Перетащите для изменения порядка">⋮⋮</div>
        <div class="form-row">
            <div class="form-field">
                <label>Учебное заведение *</label>
                <input type="text" class="edu-school" required>
            </div>
            <div class="form-field">
                <label>Степень/Специальность *</label>
                <input type="text" class="edu-degree" required>
            </div>
        </div>
        <div class="form-row">
            <div class="form-field">
                <label>Дата начала</label>
                <input type="month" class="edu-start">
            </div>
            <div class="form-field">
                <label>Дата окончания</label>
                <input type="month" class="edu-end">
            </div>
        </div>
        <button type="button" class="btn-remove" onclick="removeEducation(this)">Удалить</button>
    `;
    container.appendChild(newItem);
    
    // Настройка Drag & Drop
    setupDragAndDrop(newItem, container);
    
    generateCV();
    saveToLocalStorage();
    updateProgress();
}

// Удаление образования
function removeEducation(button) {
    const container = document.getElementById('educationContainer');
    if (container.children.length > 1) {
        button.parentElement.remove();
        generateCV();
        saveToLocalStorage();
        updateProgress();
    } else {
        showNotification('Должен быть хотя бы один пункт образования', 'error');
    }
}

// Добавление языка
function addLanguage() {
    const container = document.getElementById('languagesContainer');
    const newItem = document.createElement('div');
    newItem.className = 'language-item';
    newItem.innerHTML = `
        <div class="form-row">
            <div class="form-field">
                <label>Язык *</label>
                <input type="text" class="lang-name" required>
            </div>
            <div class="form-field">
                <label>Уровень *</label>
                <select class="lang-level" required>
                    <option value="">Выберите уровень</option>
                    <option value="A1">A1 - Начальный</option>
                    <option value="A2">A2 - Элементарный</option>
                    <option value="B1">B1 - Средний</option>
                    <option value="B2">B2 - Выше среднего</option>
                    <option value="C1">C1 - Продвинутый</option>
                    <option value="C2">C2 - Владение в совершенстве</option>
                    <option value="Родной">Родной</option>
                </select>
            </div>
        </div>
        <button type="button" class="btn-remove" onclick="removeLanguage(this)">Удалить</button>
    `;
    container.appendChild(newItem);
    generateCV();
    saveToLocalStorage();
    updateProgress();
}

// Удаление языка
function removeLanguage(button) {
    const container = document.getElementById('languagesContainer');
    if (container.children.length > 1) {
        button.parentElement.remove();
        generateCV();
        saveToLocalStorage();
        updateProgress();
    } else {
        showNotification('Должен быть хотя бы один язык', 'error');
    }
}

// ========== ПРОЕКТЫ ==========
function addProject() {
    const container = document.getElementById('projectsContainer');
    const newItem = document.createElement('div');
    newItem.className = 'project-item';
    newItem.innerHTML = `
        <div class="form-row">
            <div class="form-field">
                <label>Название проекта *</label>
                <input type="text" class="proj-name" required>
            </div>
            <div class="form-field">
                <label>Ссылка</label>
                <input type="url" class="proj-url" placeholder="https://...">
            </div>
        </div>
        <div class="form-field">
            <label>Описание</label>
            <textarea class="proj-description" rows="3" placeholder="Опишите проект и используемые технологии..."></textarea>
        </div>
        <button type="button" class="btn-remove" onclick="removeProject(this)">Удалить</button>
    `;
    container.appendChild(newItem);
    generateCV();
    saveToLocalStorage();
    updateProgress();
}

function removeProject(button) {
    const container = document.getElementById('projectsContainer');
    if (container.children.length > 1) {
        button.parentElement.remove();
        generateCV();
        saveToLocalStorage();
        updateProgress();
    } else {
        showNotification('Должен быть хотя бы один проект', 'error');
    }
}

// ========== СЕРТИФИКАТЫ ==========
function addCertificate() {
    const container = document.getElementById('certificatesContainer');
    const newItem = document.createElement('div');
    newItem.className = 'certificate-item';
    newItem.innerHTML = `
        <div class="form-row">
            <div class="form-field">
                <label>Название сертификата *</label>
                <input type="text" class="cert-name" required>
            </div>
            <div class="form-field">
                <label>Организация</label>
                <input type="text" class="cert-org">
            </div>
        </div>
        <div class="form-row">
            <div class="form-field">
                <label>Дата получения</label>
                <input type="month" class="cert-date">
            </div>
            <div class="form-field">
                <label>Ссылка на сертификат</label>
                <input type="url" class="cert-url" placeholder="https://...">
            </div>
        </div>
        <button type="button" class="btn-remove" onclick="removeCertificate(this)">Удалить</button>
    `;
    container.appendChild(newItem);
    generateCV();
    saveToLocalStorage();
    updateProgress();
}

function removeCertificate(button) {
    const container = document.getElementById('certificatesContainer');
    if (container.children.length > 1) {
        button.parentElement.remove();
        generateCV();
        saveToLocalStorage();
        updateProgress();
    } else {
        showNotification('Должен быть хотя бы один сертификат', 'error');
    }
}

// Очистка формы
function clearForm() {
    if (confirm('Вы уверены, что хотите очистить всю форму?')) {
        document.getElementById('cvForm').reset();
        // Очистка динамических контейнеров до одного элемента
        const containers = ['experienceContainer', 'educationContainer', 'languagesContainer', 'projectsContainer', 'certificatesContainer'];
        containers.forEach(containerId => {
            const container = document.getElementById(containerId);
            while (container.children.length > 1) {
                container.lastElementChild.remove();
            }
        });
        document.getElementById('cvPreview').innerHTML = `
            <div class="cv-placeholder">
                <p>Заполните форму слева, чтобы увидеть предпросмотр резюме</p>
            </div>
        `;
        localStorage.removeItem(STORAGE_KEY);
        updateProgress();
        showNotification('Форма очищена', 'info');
    }
}

// Генерация резюме
function generateCV() {
    const preview = document.getElementById('cvPreview');
    
    // Сбор данных из формы
    const data = collectFormData();
    
    // Проверка обязательных полей
    if (!data.firstName || !data.lastName || !data.email || !data.phone) {
        preview.innerHTML = `
            <div class="cv-placeholder">
                <p>Заполните обязательные поля (отмечены *) для просмотра резюме</p>
            </div>
        `;
        return;
    }
    
    // Генерация HTML резюме
    let cvHTML = `
        <div class="cv-content template-${currentTemplate} color-${currentColorScheme}">
            <div class="cv-header">
                ${data.photo ? `<div class="cv-photo"><img src="${data.photo}" alt="Фото профиля"></div>` : ''}
                <h1>${data.firstName} ${data.lastName}</h1>
                <div class="contact-info">
                    ${data.email ? `<span>📧 ${data.email}</span>` : ''}
                    ${data.phone ? `<span>📱 ${data.phone}</span>` : ''}
                    ${data.address ? `<span>📍 ${data.address}</span>` : ''}
                    ${data.linkedin ? `<span><a href="${data.linkedin}" target="_blank">LinkedIn</a></span>` : ''}
                    ${data.github ? `<span><a href="${data.github}" target="_blank">GitHub</a></span>` : ''}
                </div>
            </div>
    `;
    
    // О себе
    if (data.summary) {
        cvHTML += `
            <div class="cv-section">
                <h2>О себе</h2>
                <p>${data.summary}</p>
            </div>
        `;
    }
    
    // Опыт работы
    if (data.experience && data.experience.length > 0) {
        cvHTML += `
            <div class="cv-section">
                <h2>Опыт работы</h2>
        `;
        data.experience.forEach(exp => {
            const startDate = formatDate(exp.start);
            const endDate = exp.current ? 'По настоящее время' : formatDate(exp.end);
            cvHTML += `
                <div class="cv-item">
                    <div class="cv-item-header">
                        <div>
                            <div class="cv-item-title">${exp.position}</div>
                            <div class="cv-item-company">${exp.company}</div>
                        </div>
                        <div class="cv-item-date">${startDate} - ${endDate}</div>
                    </div>
                    ${exp.description ? `<div class="cv-item-description">${exp.description}</div>` : ''}
                </div>
            `;
        });
        cvHTML += `</div>`;
    }
    
    // Образование
    if (data.education && data.education.length > 0) {
        cvHTML += `
            <div class="cv-section">
                <h2>Образование</h2>
        `;
        data.education.forEach(edu => {
            const startDate = edu.start ? formatDate(edu.start) : '';
            const endDate = edu.end ? formatDate(edu.end) : '';
            const dateRange = startDate && endDate ? `${startDate} - ${endDate}` : (endDate || startDate || '');
            cvHTML += `
                <div class="cv-item">
                    <div class="cv-item-header">
                        <div>
                            <div class="cv-item-title">${edu.degree}</div>
                            <div class="cv-item-company">${edu.school}</div>
                        </div>
                        ${dateRange ? `<div class="cv-item-date">${dateRange}</div>` : ''}
                    </div>
                </div>
            `;
        });
        cvHTML += `</div>`;
    }
    
    // Навыки
    if (data.skills && data.skills.length > 0) {
        cvHTML += `
            <div class="cv-section">
                <h2>Навыки</h2>
                <div class="skills-list">
        `;
        data.skills.forEach(skill => {
            cvHTML += `<span class="skill-tag">${skill.trim()}</span>`;
        });
        cvHTML += `
                </div>
            </div>
        `;
    }
    
    // Языки
    if (data.languages && data.languages.length > 0) {
        cvHTML += `
            <div class="cv-section">
                <h2>Языки</h2>
                <div class="languages-list">
        `;
        data.languages.forEach(lang => {
            cvHTML += `
                <div class="language-item-preview">
                    <span><strong>${lang.name}</strong></span>
                    <span>${lang.level}</span>
                </div>
            `;
        });
        cvHTML += `
                </div>
            </div>
        `;
    }
    
    // Проекты
    if (data.projects && data.projects.length > 0) {
        cvHTML += `
            <div class="cv-section">
                <h2>Проекты</h2>
        `;
        data.projects.forEach(proj => {
            cvHTML += `
                <div class="cv-item">
                    <div class="cv-item-header">
                        <div>
                            <div class="cv-item-title">${proj.name}</div>
                            ${proj.url ? `<div class="cv-item-company"><a href="${proj.url}" target="_blank">${proj.url}</a></div>` : ''}
                        </div>
                    </div>
                    ${proj.description ? `<div class="cv-item-description">${proj.description}</div>` : ''}
                </div>
            `;
        });
        cvHTML += `</div>`;
    }
    
    // Сертификаты
    if (data.certificates && data.certificates.length > 0) {
        cvHTML += `
            <div class="cv-section">
                <h2>Сертификаты</h2>
        `;
        data.certificates.forEach(cert => {
            const certDate = cert.date ? formatDate(cert.date) : '';
            cvHTML += `
                <div class="cv-item">
                    <div class="cv-item-header">
                        <div>
                            <div class="cv-item-title">${cert.name}</div>
                            ${cert.org ? `<div class="cv-item-company">${cert.org}</div>` : ''}
                        </div>
                        ${certDate ? `<div class="cv-item-date">${certDate}</div>` : ''}
                    </div>
                    ${cert.url ? `<div class="cv-item-description"><a href="${cert.url}" target="_blank">Просмотреть сертификат</a></div>` : ''}
                </div>
            `;
        });
        cvHTML += `</div>`;
    }
    
    cvHTML += `</div>`;
    
    preview.innerHTML = cvHTML;
}

// Сбор данных из формы
function collectFormData() {
    const photoPreview = document.getElementById('photoPreview');
    const photoImg = photoPreview ? photoPreview.querySelector('img') : null;
    const photoData = photoImg ? photoImg.src : '';
    
    const data = {
        firstName: document.getElementById('firstName').value,
        lastName: document.getElementById('lastName').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        address: document.getElementById('address').value,
        linkedin: document.getElementById('linkedin').value,
        github: document.getElementById('github').value,
        summary: document.getElementById('summary').value,
        photo: photoData,
        experience: [],
        education: [],
        skills: [],
        languages: [],
        projects: [],
        certificates: []
    };
    
    // Сбор опыта работы
    const experienceItems = document.querySelectorAll('.experience-item');
    experienceItems.forEach(item => {
        const position = item.querySelector('.exp-position').value;
        const company = item.querySelector('.exp-company').value;
        const start = item.querySelector('.exp-start').value;
        const endInput = item.querySelector('.exp-end');
        const current = item.querySelector('.exp-current').checked;
        const end = current ? null : endInput.value;
        const description = item.querySelector('.exp-description').value;
        
        if (position && company && start) {
            data.experience.push({
                position,
                company,
                start,
                end,
                current,
                description
            });
        }
    });
    
    // Сбор образования
    const educationItems = document.querySelectorAll('.education-item');
    educationItems.forEach(item => {
        const school = item.querySelector('.edu-school').value;
        const degree = item.querySelector('.edu-degree').value;
        const start = item.querySelector('.edu-start').value;
        const end = item.querySelector('.edu-end').value;
        
        if (school && degree) {
            data.education.push({
                school,
                degree,
                start,
                end
            });
        }
    });
    
    // Сбор навыков
    const skillsInput = document.getElementById('skills').value;
    if (skillsInput) {
        data.skills = skillsInput.split(',').filter(skill => skill.trim());
    }
    
    // Сбор языков
    const languageItems = document.querySelectorAll('.language-item');
    languageItems.forEach(item => {
        const name = item.querySelector('.lang-name').value;
        const level = item.querySelector('.lang-level').value;
        
        if (name && level) {
            data.languages.push({ name, level });
        }
    });
    
    // Сбор проектов
    const projectItems = document.querySelectorAll('.project-item');
    projectItems.forEach(item => {
        const name = item.querySelector('.proj-name').value;
        const url = item.querySelector('.proj-url').value;
        const description = item.querySelector('.proj-description').value;
        
        if (name) {
            data.projects.push({ name, url, description });
        }
    });
    
    // Сбор сертификатов
    const certificateItems = document.querySelectorAll('.certificate-item');
    certificateItems.forEach(item => {
        const name = item.querySelector('.cert-name').value;
        const org = item.querySelector('.cert-org').value;
        const date = item.querySelector('.cert-date').value;
        const url = item.querySelector('.cert-url').value;
        
        if (name) {
            data.certificates.push({ name, org, date, url });
        }
    });
    
    return data;
}

// ========== ЗАПОЛНЕНИЕ ФОРМЫ ИЗ ДАННЫХ ==========
function populateForm(data) {
    // Основные поля
    if (data.firstName) document.getElementById('firstName').value = data.firstName;
    if (data.lastName) document.getElementById('lastName').value = data.lastName;
    if (data.email) document.getElementById('email').value = data.email;
    if (data.phone) document.getElementById('phone').value = data.phone;
    if (data.address) document.getElementById('address').value = data.address;
    if (data.linkedin) document.getElementById('linkedin').value = data.linkedin;
    if (data.github) document.getElementById('github').value = data.github;
    if (data.summary) document.getElementById('summary').value = data.summary;
    if (data.skills) document.getElementById('skills').value = data.skills.join(', ');
    
    // Загрузка фото
    if (data.photo) {
        const photoPreview = document.getElementById('photoPreview');
        const photoRemoveBtn = document.getElementById('photoRemoveBtn');
        photoPreview.innerHTML = '';
        const img = document.createElement('img');
        img.src = data.photo;
        img.alt = 'Фото профиля';
        photoPreview.appendChild(img);
        photoPreview.classList.add('has-photo');
        photoRemoveBtn.style.display = 'block';
    }
    
    // Опыт работы
    if (data.experience && data.experience.length > 0) {
        const container = document.getElementById('experienceContainer');
        container.innerHTML = '';
        data.experience.forEach(exp => {
            addExperience();
            const lastItem = container.lastElementChild;
            lastItem.querySelector('.exp-position').value = exp.position || '';
            lastItem.querySelector('.exp-company').value = exp.company || '';
            lastItem.querySelector('.exp-start').value = exp.start || '';
            lastItem.querySelector('.exp-end').value = exp.end || '';
            lastItem.querySelector('.exp-current').checked = exp.current || false;
            lastItem.querySelector('.exp-description').value = exp.description || '';
            if (exp.current) {
                lastItem.querySelector('.exp-end').disabled = true;
            }
        });
    }
    
    // Образование
    if (data.education && data.education.length > 0) {
        const container = document.getElementById('educationContainer');
        container.innerHTML = '';
        data.education.forEach(edu => {
            addEducation();
            const lastItem = container.lastElementChild;
            lastItem.querySelector('.edu-school').value = edu.school || '';
            lastItem.querySelector('.edu-degree').value = edu.degree || '';
            lastItem.querySelector('.edu-start').value = edu.start || '';
            lastItem.querySelector('.edu-end').value = edu.end || '';
        });
    }
    
    // Языки
    if (data.languages && data.languages.length > 0) {
        const container = document.getElementById('languagesContainer');
        container.innerHTML = '';
        data.languages.forEach(lang => {
            addLanguage();
            const lastItem = container.lastElementChild;
            lastItem.querySelector('.lang-name').value = lang.name || '';
            lastItem.querySelector('.lang-level').value = lang.level || '';
        });
    }
    
    // Проекты
    if (data.projects && data.projects.length > 0) {
        const container = document.getElementById('projectsContainer');
        container.innerHTML = '';
        data.projects.forEach(proj => {
            addProject();
            const lastItem = container.lastElementChild;
            lastItem.querySelector('.proj-name').value = proj.name || '';
            lastItem.querySelector('.proj-url').value = proj.url || '';
            lastItem.querySelector('.proj-description').value = proj.description || '';
        });
    }
    
    // Сертификаты
    if (data.certificates && data.certificates.length > 0) {
        const container = document.getElementById('certificatesContainer');
        container.innerHTML = '';
        data.certificates.forEach(cert => {
            addCertificate();
            const lastItem = container.lastElementChild;
            lastItem.querySelector('.cert-name').value = cert.name || '';
            lastItem.querySelector('.cert-org').value = cert.org || '';
            lastItem.querySelector('.cert-date').value = cert.date || '';
            lastItem.querySelector('.cert-url').value = cert.url || '';
        });
    }
}

// Форматирование даты
function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString + '-01');
    const months = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 
                    'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

// ========== ЭКСПОРТ В PDF ==========
function exportToPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
    });
    
    const cvContent = document.querySelector('.cv-content');
    if (!cvContent) {
        showNotification('Сначала создайте резюме, заполнив форму', 'error');
        return;
    }
    
    // Получаем данные для PDF
    const data = collectFormData();
    
    let yPos = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - 2 * margin;
    
    // Заголовок
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text(`${data.firstName} ${data.lastName}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;
    
    // Контакты
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    let contactText = '';
    if (data.email) contactText += data.email;
    if (data.phone) contactText += (contactText ? ' | ' : '') + data.phone;
    if (data.address) contactText += (contactText ? ' | ' : '') + data.address;
    if (contactText) {
        doc.text(contactText, pageWidth / 2, yPos, { align: 'center' });
        yPos += 8;
    }
    
    // Линия разделения
    doc.setLineWidth(0.5);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;
    
    // О себе
    if (data.summary) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('О себе', margin, yPos);
        yPos += 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        const summaryLines = doc.splitTextToSize(data.summary, maxWidth);
        doc.text(summaryLines, margin, yPos);
        yPos += summaryLines.length * 5 + 5;
    }
    
    // Опыт работы
    if (data.experience.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Опыт работы', margin, yPos);
        yPos += 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        data.experience.forEach(exp => {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.setFont('helvetica', 'bold');
            doc.text(exp.position, margin, yPos);
            yPos += 6;
            
            doc.setFont('helvetica', 'normal');
            doc.text(exp.company, margin, yPos);
            const startDate = formatDate(exp.start);
            const endDate = exp.current ? 'По настоящее время' : formatDate(exp.end);
            doc.text(`${startDate} - ${endDate}`, pageWidth - margin, yPos, { align: 'right' });
            yPos += 6;
            
            if (exp.description) {
                const descLines = doc.splitTextToSize(exp.description, maxWidth);
                doc.text(descLines, margin, yPos);
                yPos += descLines.length * 5;
            }
            yPos += 5;
        });
    }
    
    // Образование
    if (data.education.length > 0) {
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Образование', margin, yPos);
        yPos += 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        data.education.forEach(edu => {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.setFont('helvetica', 'bold');
            doc.text(edu.degree, margin, yPos);
            yPos += 6;
            
            doc.setFont('helvetica', 'normal');
            doc.text(edu.school, margin, yPos);
            if (edu.start || edu.end) {
                const startDate = edu.start ? formatDate(edu.start) : '';
                const endDate = edu.end ? formatDate(edu.end) : '';
                const dateRange = startDate && endDate ? `${startDate} - ${endDate}` : (endDate || startDate || '');
                doc.text(dateRange, pageWidth - margin, yPos, { align: 'right' });
            }
            yPos += 8;
        });
    }
    
    // Навыки
    if (data.skills.length > 0) {
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Навыки', margin, yPos);
        yPos += 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        doc.text(data.skills.join(', '), margin, yPos);
        yPos += 10;
    }
    
    // Языки
    if (data.languages.length > 0) {
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Языки', margin, yPos);
        yPos += 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        data.languages.forEach(lang => {
            doc.text(`${lang.name} - ${lang.level}`, margin, yPos);
            yPos += 6;
        });
    }
    
    // Проекты
    if (data.projects && data.projects.length > 0) {
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Проекты', margin, yPos);
        yPos += 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        data.projects.forEach(proj => {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
            doc.setFont('helvetica', 'bold');
            doc.text(proj.name, margin, yPos);
            yPos += 6;
            doc.setFont('helvetica', 'normal');
            if (proj.url) {
                doc.setTextColor(0, 0, 255);
                doc.text(proj.url, margin, yPos);
                doc.setTextColor(0, 0, 0);
                yPos += 6;
            }
            if (proj.description) {
                const descLines = doc.splitTextToSize(proj.description, maxWidth);
                doc.text(descLines, margin, yPos);
                yPos += descLines.length * 5;
            }
            yPos += 5;
        });
    }
    
    // Сертификаты
    if (data.certificates && data.certificates.length > 0) {
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Сертификаты', margin, yPos);
        yPos += 8;
        doc.setFontSize(10);
        doc.setFont('helvetica', 'normal');
        
        data.certificates.forEach(cert => {
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
            doc.setFont('helvetica', 'bold');
            doc.text(cert.name, margin, yPos);
            yPos += 6;
            doc.setFont('helvetica', 'normal');
            if (cert.org) {
                doc.text(cert.org, margin, yPos);
                yPos += 6;
            }
            if (cert.date) {
                const certDate = formatDate(cert.date);
                doc.text(certDate, pageWidth - margin, yPos, { align: 'right' });
                yPos += 6;
            }
            if (cert.url) {
                doc.setTextColor(0, 0, 255);
                doc.text(cert.url, margin, yPos);
                doc.setTextColor(0, 0, 0);
                yPos += 6;
            }
            yPos += 5;
        });
    }
    
    // Сохранение PDF
    const fileName = `${data.firstName}_${data.lastName}_CV.pdf`;
    doc.save(fileName);
    showNotification('Резюме экспортировано в PDF', 'success');
}

// Печать резюме
function printCV() {
    const cvContent = document.querySelector('.cv-content');
    if (!cvContent) {
        showNotification('Сначала создайте резюме, заполнив форму', 'error');
        return;
    }
    
    window.print();
}

// ========== ЭКСПОРТ/ИМПОРТ JSON ==========
function exportToJSON() {
    const data = collectFormData();
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.firstName || 'cv'}_${data.lastName || 'resume'}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('Данные экспортированы в JSON', 'success');
}

function importFromJSON() {
    document.getElementById('jsonFileInput').click();
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            populateForm(data);
            generateCV();
            saveToLocalStorage();
            updateProgress();
            showNotification('Данные успешно импортированы', 'success');
        } catch (error) {
            showNotification('Ошибка при импорте файла', 'error');
            console.error('Ошибка импорта:', error);
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Сброс input
}

// ========== DRAG & DROP ДЛЯ СЕКЦИЙ ==========
function setupDragAndDrop(item, container) {
    let draggedElement = null;
    
    // Обработчик начала перетаскивания
    item.addEventListener('dragstart', function(e) {
        draggedElement = this;
        this.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', this.innerHTML);
    });
    
    // Обработчик окончания перетаскивания
    item.addEventListener('dragend', function(e) {
        this.classList.remove('dragging');
        // Убираем класс drag-over со всех элементов
        container.querySelectorAll('.drag-over').forEach(el => {
            el.classList.remove('drag-over');
        });
    });
    
    // Обработчик наведения на элемент
    item.addEventListener('dragover', function(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        
        if (draggedElement && draggedElement !== this) {
            const rect = this.getBoundingClientRect();
            const next = (e.clientY - rect.top) < (rect.height / 2);
            
            this.classList.add('drag-over');
            
            if (next) {
                container.insertBefore(draggedElement, this);
            } else {
                container.insertBefore(draggedElement, this.nextSibling);
            }
        }
    });
    
    // Обработчик выхода из элемента
    item.addEventListener('dragleave', function(e) {
        this.classList.remove('drag-over');
    });
    
    // Обработчик отпускания
    item.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('drag-over');
        
        if (draggedElement && draggedElement !== this) {
            generateCV();
            saveToLocalStorage();
            showNotification('Порядок изменен', 'success');
        }
    });
    
    // Предотвращаем перетаскивание при клике на инпут
    const inputs = item.querySelectorAll('input, textarea, select, button');
    inputs.forEach(input => {
        input.addEventListener('mousedown', function(e) {
            e.stopPropagation();
        });
    });
}

// Инициализация Drag & Drop для существующих элементов
function initDragAndDrop() {
    const experienceContainer = document.getElementById('experienceContainer');
    const educationContainer = document.getElementById('educationContainer');
    
    if (experienceContainer) {
        experienceContainer.querySelectorAll('.experience-item').forEach(item => {
            item.classList.add('draggable');
            item.draggable = true;
            if (!item.querySelector('.drag-handle')) {
                const handle = document.createElement('div');
                handle.className = 'drag-handle';
                handle.textContent = '⋮⋮';
                handle.title = 'Перетащите для изменения порядка';
                item.insertBefore(handle, item.firstChild);
            }
            setupDragAndDrop(item, experienceContainer);
        });
    }
    
    if (educationContainer) {
        educationContainer.querySelectorAll('.education-item').forEach(item => {
            item.classList.add('draggable');
            item.draggable = true;
            if (!item.querySelector('.drag-handle')) {
                const handle = document.createElement('div');
                handle.className = 'drag-handle';
                handle.textContent = '⋮⋮';
                handle.title = 'Перетащите для изменения порядка';
                item.insertBefore(handle, item.firstChild);
            }
            setupDragAndDrop(item, educationContainer);
        });
    }
}

// ========== ЗАГРУЗКА ФОТО ==========
function handlePhotoUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    // Проверка типа файла
    if (!file.type.startsWith('image/')) {
        showNotification('Пожалуйста, выберите изображение', 'error');
        return;
    }
    
    // Проверка размера файла (макс 2MB)
    if (file.size > 2 * 1024 * 1024) {
        showNotification('Размер файла не должен превышать 2MB', 'error');
        return;
    }
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const photoPreview = document.getElementById('photoPreview');
        const photoRemoveBtn = document.getElementById('photoRemoveBtn');
        
        // Очищаем содержимое preview
        photoPreview.innerHTML = '';
        
        // Создаем изображение
        const img = document.createElement('img');
        img.src = e.target.result;
        img.alt = 'Фото профиля';
        photoPreview.appendChild(img);
        
        // Добавляем класс и показываем кнопку удаления
        photoPreview.classList.add('has-photo');
        photoRemoveBtn.style.display = 'block';
        
        // Обновляем резюме
        generateCV();
        saveToLocalStorage();
        showNotification('Фото загружено', 'success');
    };
    
    reader.onerror = function() {
        showNotification('Ошибка при загрузке фото', 'error');
    };
    
    reader.readAsDataURL(file);
}

function removePhoto() {
    const photoPreview = document.getElementById('photoPreview');
    const photoUpload = document.getElementById('photoUpload');
    const photoRemoveBtn = document.getElementById('photoRemoveBtn');
    
    photoPreview.innerHTML = `
        <span class="photo-placeholder">📷</span>
        <span class="photo-text">Нажмите для загрузки</span>
    `;
    photoPreview.classList.remove('has-photo');
    photoRemoveBtn.style.display = 'none';
    photoUpload.value = '';
    
    generateCV();
    saveToLocalStorage();
    showNotification('Фото удалено', 'info');
}

// ========== ПОДСЧЕТ СИМВОЛОВ ==========
function updateCharCounter(fieldId, maxLength) {
    const field = document.getElementById(fieldId);
    const counter = document.getElementById(fieldId + 'Counter');
    if (field && counter) {
        const length = field.value.length;
        const percentage = (length / maxLength) * 100;
        counter.textContent = `${length} / ${maxLength}`;
        
        // Обновляем стиль в зависимости от заполненности
        counter.classList.remove('warning', 'full');
        if (percentage >= 90) {
            counter.classList.add('full');
        } else if (percentage >= 70) {
            counter.classList.add('warning');
        }
    }
}

function updateCharCounterForElement(element, maxLength) {
    const counter = element.previousElementSibling;
    if (counter && counter.classList.contains('char-counter')) {
        const length = element.value.length;
        const percentage = (length / maxLength) * 100;
        counter.textContent = `${length} / ${maxLength}`;
        
        // Обновляем стиль в зависимости от заполненности
        counter.classList.remove('warning', 'full');
        if (percentage >= 90) {
            counter.classList.add('full');
        } else if (percentage >= 70) {
            counter.classList.add('warning');
        }
    }
}

// Инициализация счетчиков символов
function initCharCounters() {
    const summaryField = document.getElementById('summary');
    if (summaryField) {
        updateCharCounter('summary', 500);
    }
}

// ========== ПОДСКАЗКИ И ПРИМЕРЫ ==========
function showExample(fieldId, exampleText) {
    const exampleDiv = document.getElementById(fieldId + 'Example');
    if (exampleDiv) {
        if (exampleDiv.classList.contains('show')) {
            exampleDiv.classList.remove('show');
            exampleDiv.innerHTML = '';
        } else {
            // Заменяем \n на <br> для правильного отображения переносов строк
            const formattedText = exampleText.replace(/\n/g, '<br>');
            exampleDiv.innerHTML = formattedText;
            exampleDiv.classList.add('show');
        }
    }
}

function showExampleForElement(button, exampleText) {
    const exampleDiv = button.nextElementSibling;
    if (exampleDiv && exampleDiv.classList.contains('example-text')) {
        if (exampleDiv.classList.contains('show')) {
            exampleDiv.classList.remove('show');
            button.textContent = 'Показать пример';
        } else {
            // Заменяем \n на <br> для правильного отображения переносов строк
            const formattedText = exampleText.replace(/\n/g, '<br>');
            exampleDiv.innerHTML = formattedText;
            exampleDiv.classList.add('show');
            button.textContent = 'Скрыть пример';
        }
    }
}

// Инициализация подсказок при наведении (вызывается из основного DOMContentLoaded)
function initTooltips() {
    const helpIcons = document.querySelectorAll('.help-icon');
    helpIcons.forEach(icon => {
        const helpText = icon.getAttribute('data-help');
        if (helpText && !icon.querySelector('.tooltip')) {
            const tooltip = document.createElement('span');
            tooltip.className = 'tooltip';
            tooltip.textContent = helpText;
            icon.appendChild(tooltip);
        }
    });
}

// ========== QR-КОД ==========
function generateQRCode() {
    const cvContent = document.querySelector('.cv-content');
    if (!cvContent) {
        showNotification('Сначала создайте резюме, заполнив форму', 'error');
        return;
    }
    
    // Проверяем наличие библиотеки QRCode
    if (typeof QRCode === 'undefined') {
        showNotification('Библиотека QRCode не загружена. Проверьте подключение к интернету.', 'error');
        return;
    }
    
    const data = collectFormData();
    const qrContainer = document.getElementById('qrCodeContainer');
    const qrCodeDiv = document.getElementById('qrCode');
    
    if (!qrContainer || !qrCodeDiv) {
        showNotification('Элементы QR-кода не найдены', 'error');
        return;
    }
    
    // Создаем текстовое представление резюме для QR-кода
    let cvText = `${data.firstName} ${data.lastName}\n\n`;
    if (data.email) cvText += `Email: ${data.email}\n`;
    if (data.phone) cvText += `Телефон: ${data.phone}\n`;
    if (data.address) cvText += `Адрес: ${data.address}\n`;
    if (data.linkedin) cvText += `LinkedIn: ${data.linkedin}\n`;
    if (data.github) cvText += `GitHub: ${data.github}\n`;
    if (data.summary) cvText += `\n${data.summary}\n`;
    
    // Очищаем предыдущий QR-код
    qrCodeDiv.innerHTML = '';
    
    // Генерируем QR-код
    try {
        new QRCode(qrCodeDiv, {
            text: cvText,
            width: 200,
            height: 200,
            colorDark: '#000000',
            colorLight: '#ffffff',
            correctLevel: typeof QRCode !== 'undefined' && QRCode.CorrectLevel ? QRCode.CorrectLevel.H : 2
        });
        
        // Показываем контейнер
        qrContainer.style.display = 'block';
        showNotification('QR-код сгенерирован', 'success');
        
        // Прокручиваем к QR-коду
        setTimeout(() => {
            qrContainer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }, 100);
    } catch (error) {
        console.error('Ошибка генерации QR-кода:', error);
        showNotification('Ошибка генерации QR-кода: ' + error.message, 'error');
    }
}

// ========== ЭКСПОРТ В MARKDOWN ==========
function exportToMarkdown() {
    const cvContent = document.querySelector('.cv-content');
    if (!cvContent) {
        showNotification('Сначала создайте резюме, заполнив форму', 'error');
        return;
    }
    
    const data = collectFormData();
    let markdown = `# ${data.firstName} ${data.lastName}\n\n`;
    
    // Контакты
    markdown += `## Контакты\n\n`;
    if (data.email) markdown += `- 📧 Email: ${data.email}\n`;
    if (data.phone) markdown += `- 📱 Телефон: ${data.phone}\n`;
    if (data.address) markdown += `- 📍 Адрес: ${data.address}\n`;
    if (data.linkedin) markdown += `- 💼 LinkedIn: [${data.linkedin}](${data.linkedin})\n`;
    if (data.github) markdown += `- 💻 GitHub: [${data.github}](${data.github})\n`;
    markdown += `\n`;
    
    // О себе
    if (data.summary) {
        markdown += `## О себе\n\n${data.summary}\n\n`;
    }
    
    // Опыт работы
    if (data.experience && data.experience.length > 0) {
        markdown += `## Опыт работы\n\n`;
        data.experience.forEach(exp => {
            const startDate = formatDate(exp.start);
            const endDate = exp.current ? 'По настоящее время' : formatDate(exp.end);
            markdown += `### ${exp.position}\n`;
            markdown += `**${exp.company}** | ${startDate} - ${endDate}\n\n`;
            if (exp.description) {
                markdown += `${exp.description}\n\n`;
            }
        });
    }
    
    // Образование
    if (data.education && data.education.length > 0) {
        markdown += `## Образование\n\n`;
        data.education.forEach(edu => {
            const startDate = edu.start ? formatDate(edu.start) : '';
            const endDate = edu.end ? formatDate(edu.end) : '';
            const dateRange = startDate && endDate ? `${startDate} - ${endDate}` : (endDate || startDate || '');
            markdown += `### ${edu.degree}\n`;
            markdown += `**${edu.school}**`;
            if (dateRange) markdown += ` | ${dateRange}`;
            markdown += `\n\n`;
        });
    }
    
    // Навыки
    if (data.skills && data.skills.length > 0) {
        markdown += `## Навыки\n\n`;
        markdown += data.skills.map(skill => `- ${skill.trim()}`).join('\n');
        markdown += `\n\n`;
    }
    
    // Языки
    if (data.languages && data.languages.length > 0) {
        markdown += `## Языки\n\n`;
        data.languages.forEach(lang => {
            markdown += `- **${lang.name}**: ${lang.level}\n`;
        });
        markdown += `\n`;
    }
    
    // Проекты
    if (data.projects && data.projects.length > 0) {
        markdown += `## Проекты\n\n`;
        data.projects.forEach(proj => {
            markdown += `### ${proj.name}\n`;
            if (proj.url) markdown += `🔗 [${proj.url}](${proj.url})\n\n`;
            if (proj.description) markdown += `${proj.description}\n\n`;
        });
    }
    
    // Сертификаты
    if (data.certificates && data.certificates.length > 0) {
        markdown += `## Сертификаты\n\n`;
        data.certificates.forEach(cert => {
            const certDate = cert.date ? formatDate(cert.date) : '';
            markdown += `### ${cert.name}\n`;
            if (cert.org) markdown += `**${cert.org}**`;
            if (certDate) markdown += ` | ${certDate}`;
            markdown += `\n`;
            if (cert.url) markdown += `🔗 [Просмотреть сертификат](${cert.url})\n`;
            markdown += `\n`;
        });
    }
    
    // Сохранение файла
    const blob = new Blob([markdown], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.firstName || 'cv'}_${data.lastName || 'resume'}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('Резюме экспортировано в Markdown', 'success');
}

// ========== ЭКСПОРТ В HTML ==========
function exportToHTML() {
    const cvContent = document.querySelector('.cv-content');
    if (!cvContent) {
        showNotification('Сначала создайте резюме, заполнив форму', 'error');
        return;
    }
    
    const data = collectFormData();
    const html = `
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Резюме - ${data.firstName} ${data.lastName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 40px 20px;
            line-height: 1.6;
            color: #1e293b;
        }
        .cv-header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 2px solid #4f46e5;
        }
        .cv-header h1 {
            font-size: 2rem;
            margin-bottom: 10px;
        }
        .contact-info {
            display: flex;
            justify-content: center;
            flex-wrap: wrap;
            gap: 15px;
            color: #64748b;
        }
        .cv-section {
            margin-bottom: 25px;
        }
        .cv-section h2 {
            font-size: 1.3rem;
            color: #4f46e5;
            margin-bottom: 15px;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 5px;
        }
        .cv-item {
            margin-bottom: 20px;
        }
        .cv-item-header {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
        }
        .cv-item-title {
            font-weight: 600;
            font-size: 1rem;
        }
        .cv-item-company {
            color: #64748b;
        }
        .cv-item-date {
            color: #64748b;
            font-size: 0.85rem;
            font-style: italic;
        }
        .cv-item-description {
            margin-top: 8px;
            font-size: 0.9rem;
        }
        .skills-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        .skill-tag {
            background: #4f46e5;
            color: white;
            padding: 5px 12px;
            border-radius: 20px;
            font-size: 0.85rem;
        }
        a {
            color: #4f46e5;
            text-decoration: none;
        }
        a:hover {
            text-decoration: underline;
        }
        @media print {
            body { padding: 0; }
        }
    </style>
</head>
<body>
    ${cvContent.outerHTML}
</body>
</html>`;
    
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${data.firstName || 'cv'}_${data.lastName || 'resume'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showNotification('Резюме экспортировано в HTML', 'success');
}
