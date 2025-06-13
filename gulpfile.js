const originalWrite = process.stderr.write // Перехоплюємо потоки stdout та stderr

process.stderr.write = function (chunk, ...args) {
  const ignoreMessages = [
    'The legacy JS API is deprecated and will be removed in Dart Sass 2.0.0',
    '[DEP0180] DeprecationWarning: fs.Stats constructor is deprecated'
  ]

  // Ігноруємо повідомлення, які містять зазначені фрази
  if (ignoreMessages.some((msg) => chunk.toString().includes(msg))) {
    return // Нічого не робимо
  }

  return originalWrite.call(process.stderr, chunk, ...args) // Викликаємо стандартний метод для інших повідомлень
}

// Импортируем все необходимые модули из Gulp
const { task, series, parallel, src, dest, watch } = require('gulp')
// Импортируем gulp-sass и сам компилятор Sass (Dart Sass)
const sass = require('gulp-sass')(require('sass'))
const replace = require('gulp-replace')
const dc = require('postcss-discard-comments') // postcss-discard-comments
const browserSync = require('browser-sync').create() // Используем .create() для инициализации
const postcss = require('gulp-postcss')
const csscomb = require('gulp-csscomb')
const cssnano = require('cssnano')
const rename = require('gulp-rename')
const autoprefixer = require('autoprefixer')
const mqpacker = require('css-mqpacker')
const sortCSSmq = require('sort-css-media-queries')
// const pug = require('gulp-pug') // УДАЛЕНО: Pug больше не нужен
const fs = require('fs'); // Добавим для createStructure

const option = process.argv[3] // Используется для чтения аргументов командной строки

const PATH = {
  scssFolder: './src/scss/',
  scssAllFiles: './src/scss/**/*.scss', // Отслеживаем все .scss файлы
  scssRootFile: './src/scss/style.scss', // Компилируем только этот файл
  // УДАЛЕНО: Pug пути
  cssFolder: './assets/css/',
  cssAllFiles: './assets/css/*.css',
  cssRootFile: './assets/css/style.css',
  htmlFolder: './', // Корневая папка для HTML (здесь будет index.html)
  htmlAllFiles: './*.html', // Отслеживаем все .html файлы в корне
  jsFolder: './assets/js/',
  jsAllFiles: './assets/js/**/*.js',
  imagesFolder: './assets/images/',
  vendorsFolder: './assets/vendors/'
}

const SEARCH_IMAGE_REGEXP = /url\(['"]?.*\/images\/(.*?)\.(png|jpe?g|gif|webp|svg)['"]?\)/g
const REPLACEMENT_IMAGE_PATH = 'url(../images/$1.$2)'

const PLUGINS = [
  dc({ discardComments: true }), // Удаление комментариев
  autoprefixer({
    overrideBrowserslist: ['last 5 versions', '> 0.1%'] // Автопрефиксы для CSS
  }),
  mqpacker({ sort: sortCSSmq }) // Сортировка медиа-запросов
]

// Главная функция компиляции SCSS для продакшена (без минификации)
function compileScss() {
  console.log('Starting SASS compilation (non-minified)...');
  return src(PATH.scssRootFile)
    .pipe(sass({
      outputStyle: 'expanded',
      includePaths: [PATH.scssFolder]
    }).on('error', sass.logError))
    .pipe(postcss(PLUGINS))
    .pipe(replace(SEARCH_IMAGE_REGEXP, REPLACEMENT_IMAGE_PATH))
    .pipe(dest(PATH.cssFolder))
    .pipe(browserSync.stream());
}

// Функция компиляции SCSS с минификацией
function compileScssMin() {
  console.log('Starting SASS compilation (minified)...');
  const pluginsForMinify = [...PLUGINS, cssnano({ preset: 'default' })];

  return src(PATH.scssRootFile)
    .pipe(sass({
      outputStyle: 'compressed',
      includePaths: [PATH.scssFolder]
    }).on('error', sass.logError))
    .pipe(replace(SEARCH_IMAGE_REGEXP, REPLACEMENT_IMAGE_PATH))
    .pipe(postcss(pluginsForMinify))
    .pipe(rename({ suffix: '.min' }))
    .pipe(dest(PATH.cssFolder));
}

// Функция компиляции SCSS для режима разработки (с sourcemaps, без автопрефиксов)
function compileScssDev() {
  console.log('Starting SASS compilation (development mode)...');
  const pluginsForDevMode = [...PLUGINS];

  return src(PATH.scssRootFile, { sourcemaps: true })
    .pipe(sass({
      outputStyle: 'expanded',
      includePaths: [PATH.scssFolder]
    }).on('error', sass.logError))
    .pipe(postcss(pluginsForDevMode))
    .pipe(replace(SEARCH_IMAGE_REGEXP, REPLACEMENT_IMAGE_PATH))
    .pipe(dest(PATH.cssFolder, { sourcemaps: true }))
    .pipe(browserSync.stream());
}

// УДАЛЕНО: Функция compilePug больше не нужна

// Функция для форматирования SCSS файлов
function comb() {
  console.log('Running CSScomb...');
  return src(PATH.scssAllFiles)
    .pipe(csscomb())
    .pipe(dest(PATH.scssFolder))
    .on('end', () => console.log('CSScomb finished.'));
}

// Инициализация BrowserSync сервера
function serverInit() {
  browserSync.init({
    server: { baseDir: './' }, // Обслуживаем файлы из корня проекта
    notify: false // Отключить уведомления BrowserSync
  });
  console.log('BrowserSync server initialized.');
}

// Перезагрузка BrowserSync
async function sync() {
  browserSync.reload();
  console.log('BrowserSync reloaded.');
}

// Функция отслеживания файлов
function watchFiles() {
  serverInit(); // Запускаем сервер при старте watch
  console.log('Watching files for changes...');

  if (!option || option === '--dev') {
    watch(PATH.scssAllFiles, compileScssDev);
  } else if (option !== '--css') {
    watch(PATH.scssAllFiles, series(compileScss, compileScssMin));
  }

  // Отслеживание HTML - теперь напрямую HTML, без Pug компиляции
  watch(PATH.htmlAllFiles, sync);
  // УДАЛЕНО: watch(PATH.pugAllFiles, series(compilePug, sync));
  watch(PATH.jsAllFiles, sync);
  watch(PATH.cssAllFiles, sync);
}

// Функция для создания структуры проекта
function createStructure() {
  console.log('Creating project structure...');
  const scssFiles = {
    abstracts: [
      '_index',
      '_variables', // змінні проекту
      '_skin', // кольори, тіні, градієнти
      '_mixins', // міксини
      '_mixins-media', // міксини для медіа-запитів
      '_extends' // плейсхолдери
    ],
    base: [
      '_index',
      '_common', // базові стилі
      '_typography' // типографіка
    ],
    layout: ['_index', '_header', '_footer', '_main'],
    components: [
      '_index'
      // тут будуть компоненти
    ],
    root: [
      'style' // головний файл
    ]
  };

  const scssAllFiles = Object.entries(scssFiles).flatMap(([folder, files]) => {
    return files.map((fileName) =>
      folder === 'root' ? `${PATH.scssFolder}${fileName}.scss` : `${PATH.scssFolder}${folder}/${fileName}.scss`
    );
  });

  const filePaths = [
    `${PATH.htmlFolder}index.html`, // Теперь создаем index.html напрямую
    // УДАЛЕНО: `${PATH.pugFolder}index.pug`, // Pug файлы не создаются
    `${PATH.cssFolder}style.css`,
    `${PATH.jsFolder}main.js`,
  ];

  // Создаем папки для SCSS
  const scssFolders = ['abstracts', 'base', 'layout', 'components'];
  scssFolders.forEach((folder) => {
    fs.mkdirSync(`${PATH.scssFolder}${folder}`, { recursive: true });
  });

  // Создаем основные папки проекта
  src('*.*', { read: false })
    .pipe(dest(PATH.scssFolder))
    // УДАЛЕНО: .pipe(dest(PATH.pugFolder)) // Папка Pug не нужна
    .pipe(dest(PATH.cssFolder))
    .pipe(dest(PATH.jsFolder))
    .pipe(dest(PATH.imagesFolder))
    .pipe(dest(PATH.vendorsFolder));

  return new Promise((resolve) =>
    setTimeout(() => {
      filePaths.forEach((filePath) => {
        const dir = filePath.substring(0, filePath.lastIndexOf('/'));
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        // Специально для index.html: создаем базовый HTML, а не пустой файл
        if (filePath === `${PATH.htmlFolder}index.html`) {
          fs.writeFileSync(filePath, `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>My Simple Website</title>
  <link rel="stylesheet" href="assets/css/normalize.css">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100..900;1,100..900&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/style.css">
</head>
<body>
  <h1>Hello, HTML World!</h1>
  <p>This is your simple website, now without Pug.</p>
  </body>
</html>`);
        } else {
          fs.writeFileSync(filePath, ''); // Остальные файлы пустые
        }
        console.log(`Created file: ${filePath}`);
      });

      // Создаем SCSS файлы после создания папок
      scssAllFiles.forEach((subPath) => {
        const dir = subPath.substring(0, subPath.lastIndexOf('/'));
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        // Если это style.scss, добавляем базовые @use правила
        if (subPath === `${PATH.scssFolder}style.scss`) {
          fs.writeFileSync(subPath, `@use 'abstracts' as *;\n@use 'base' as *;\n@use 'layout' as *;\n// @use 'components' as *;\n`);
        } else if (subPath === `${PATH.scssFolder}abstracts/_index.scss`) {
           fs.writeFileSync(subPath, `@forward 'variables';\n@forward 'mixins';\n@forward 'mixins-media';\n@forward 'extends';\n@forward 'skin';\n`);
        } else if (subPath === `${PATH.scssFolder}base/_index.scss`) {
           fs.writeFileSync(subPath, `@forward 'common';\n@forward 'typography';\n`);
        } else if (subPath === `${PATH.scssFolder}layout/_index.scss`) {
           fs.writeFileSync(subPath, `@forward 'header';\n@forward 'footer';\n@forward 'main';\n`);
        } else if (subPath === `${PATH.scssFolder}components/_index.scss`) {
           fs.writeFileSync(subPath, `// @forward 'my-component';\n`);
        }
         else {
          fs.writeFileSync(subPath, '');
        }
        console.log(`Created SCSS file: ${subPath}`);
      });
      resolve(true);
    }, 1000)
  );
}


// Экспорт задач Gulp:
task('comb', series(comb, compileScss, compileScssMin));
task('scss', series(comb, compileScss, compileScssMin));
task('dev', series(compileScssDev));
task('min', series(compileScssMin));
// УДАЛЕНО: task('pug', series(compilePug));
task('cs', series(createStructure));
task('watch', watchFiles);

// Определение задачи 'default' для запуска по умолчанию
// При запуске 'gulp' без аргументов, будут скомпилированы Sass, затем запущен watch
exports.default = series(
  compileScssDev, // Компиляция Sass для разработки
  // УДАЛЕНО: compilePug, // Pug больше не компилируется
  watchFiles // Запуск watch
);

// Экспорт задачи 'build'
exports.build = series(
  compileScss, // Компиляция в обычный CSS
  compileScssMin, // Компиляция в минифицированный CSS
  // УДАЛЕНО: compilePug, // Pug больше не компилируется
  comb // Опционально: прогнать CSScomb
);