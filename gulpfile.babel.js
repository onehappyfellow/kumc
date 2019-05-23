import gulp from "gulp";
import cp from "child_process";
import gutil from "gulp-util";
import postcss from "gulp-postcss";
import cssImport from "postcss-import";
import cssnext from "postcss-cssnext";
import BrowserSync from "browser-sync";
import webpack from "webpack";
import webpackConfig from "./webpack.conf";
import svgstore from "gulp-svgstore";
import svgmin from "gulp-svgmin";
import inject from "gulp-inject";
import cssnano from "cssnano";
import debug from "gulp-debug";
import tap from "gulp-tap";
import fs from "fs";
import imagemin from "imagemin";
import webp from "imagemin-webp";


const convertapi = require('convertapi')('inXz29zlHESNJpiI');

const browserSync = BrowserSync.create();
const defaultArgs = ["-d", "../dist", "-s", "site"];

if (process.env.DEBUG) {
  defaultArgs.unshift("--debug")
}

gulp.task("hugo", (cb) => buildSite(cb));
gulp.task("hugo-preview", (cb) => buildSite(cb, ["--buildDrafts", "--buildFuture"]));
gulp.task("build", ["css", "js", "hugo"]);
gulp.task("build-preview", ["css", "js", "hugo-preview"]);

gulp.task("css", () => (
  gulp.src("./src/css/*.css")
    .pipe(postcss([
      cssImport({from: "./src/css/main.css"}),
      cssnext(),
      cssnano(),
    ]))
    .pipe(gulp.dest("./dist/css"))
    .pipe(browserSync.stream())
));

gulp.task("js", (cb) => {
  const myConfig = Object.assign({}, webpackConfig);

  webpack(myConfig, (err, stats) => {
    if (err) throw new gutil.PluginError("webpack", err);
    gutil.log("[webpack]", stats.toString({
      colors: true,
      progress: true
    }));
    browserSync.reload();
    cb();
  });

  gulp.src("./src/js/*.js")
    .pipe(gulp.dest("./dist/js"));
});

gulp.task("svg", () => {
  const svgs = gulp
    .src("site/assets/icons/*.svg")
    .pipe(svgmin())
    .pipe(svgstore({inlineSvg: true}));

  function fileContents(filePath, file) {
    return file.contents.toString();
  }

  return gulp
    .src("site/layouts/partials/svg.html")
    .pipe(inject(svgs, {transform: fileContents}))
    .pipe(gulp.dest("site/layouts/partials/"));
});

gulp.task("voiceofnm",() => {
  const library = [];

  return gulp
    .src("./site/static/voiceofnm/*.pdf")
    .pipe(tap(function(file) {
      const filename = file.path.split('\\').pop().split('/').pop();
      const year = filename.match(/[0-9]{4}/)[0];
      let issue = filename.slice(filename.indexOf(year) + year.length, -4).replace("-","");
      const key = year + issue.slice(0,2);
      // convert typical format eg: 0102 to m/m
      if (issue.length == 4 && !isNaN(issue)) {
        issue = parseInt(issue.slice(0,2)) + "/" + parseInt(issue.slice(2,4)) + "월호";
      }
      // remove zeros from single month issues
      else if (!isNaN(issue)) {
        issue = parseInt(issue) + "월호";
      }
      else {
        issue += "호";
      }
      // add issue to object
      library.push({key, year, issue, filename});
      // write object back to file system
      fs.writeFile(`./site/data/voiceofnm.json`, JSON.stringify(library), (err) => {
        if (err) return console.error(err);
      });
    }))
    .pipe(tap(function(file) {
      const jpgPath = file.path.replace(".pdf",".jpg");
      if (!fs.existsSync(jpgPath)) {
        // console.log(`convertapi call made for ${options.File}`);
        convertapi
          .convert('thumbnail', { File: file.path, PageRange: '1', ImageResolution: '320' }, 'pdf')
          .then(function(result) {
            result.saveFiles('./site/static/voiceofnm');
          })
          .catch(err => console.error(err))
      }
    }));
});

gulp.task("images", () => {
  const JPEGImages = "./site/static/img/*.jpg";
  const PNGImages = "./site/static/img/*.png";
  const outputFolder = "./site/static/img";

  imagemin([PNGImages], outputFolder, {
    plugins: [webp({
        lossless: true // Losslessly encode images
    })]
  });
  imagemin([JPEGImages], outputFolder, {
    plugins: [webp({
      quality: 65 // Quality setting from 0 to 100
    })]
  });
});

gulp.task("server", ["hugo", "css", "js", "svg", "images", "voiceofnm"], () => {
  browserSync.init({
    server: {
      baseDir: "./dist"
    }
  });
  gulp.watch("./src/js/**/*.js", ["js"]);
  gulp.watch("./src/css/**/*.css", ["css"]);
  gulp.watch("./site/assets/icons/*.svg", ["svg"]);
  gulp.watch("./site/**/*", ["hugo"]);
});

function buildSite(cb, options) {
  const args = options ? defaultArgs.concat(options) : defaultArgs;

  return cp.spawn("hugo", args, {stdio: "inherit"}).on("close", (code) => {
    if (code === 0) {
      browserSync.reload("notify:false");
      cb();
    } else {
      browserSync.notify("Hugo build failed :(");
      cb("Hugo build failed");
    }
  });
}
