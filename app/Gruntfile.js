'use strict';

module.exports = function (grunt) {

    grunt.file.setBase('..');
    require('load-grunt-tasks')(grunt);

    grunt.initConfig({


        clean: {},

        express: {
            dev: {
                options: {
                    script: 'app/index.js',
                    node_env: 'dev',
                    port: process.env.PORT,
                    output: 'started',
                },
            },
            cron: {
                options: {
                    script: 'app/index-crons.js',
                    debug: false,
                    node_env: 'dev',
                    port: process.env.PORT,
                    output: 'started',
                },
            },
            test: {
                options: {
                    script: 'app/index.js',
                    node_env: 'test',
                    port: 5000,
                    output: 'started'
                }
            }
        },

        mochaTest: {
            unit: {
                options: {
                    reporter: 'spec',
                    quiet: false, // Optionally suppress output to standard out (defaults to false)
                    clearRequireCache: true, // Optionally clear the require cache before running tests (defaults to false)
                    require: 'co-mocha'
                },
                src: ['app/test/unit/**/*.test.js']
            },
            e2e: {
                options: {
                    reporter: 'spec',
                    quiet: false, // Optionally suppress output to standard out (defaults to false)
                    clearRequireCache: true, // Optionally clear the require cache before running tests (defaults to false)
                    timeout: 100000,
                },
                src: ['app/test/e2e/**/*.spec.js']
            }
        },
        watch: {
            options: {
                livereload: true
            },
            jssrc: {
                files: [
                    'app/src/**/*.js',
                ],
                tasks: ['mochaTest:unit', 'express:dev'],
                options: {
                    spawn: false
                }
            },
            unitTest: {
                files: [
                    'app/test/unit/**/*.test.js',
                ],
                tasks: ['mochaTest:unit'],
                options: {
                    spawn: false
                }
            },
            e2eTest: {
                files: [
                    'app/test/e2e/**/*.spec.js',
                ],
                tasks: ['mochaTest:e2e'],
                options: {
                    spawn: true
                }
            },

        },
        nyc: {
            cover: {
                options: {
                    include: ['app/src/**'],
                    exclude: '*.test.*',
                    reporter: ['lcov', 'json', 'text-summary'],
                    reportDir: 'coverage',
                    all: true
                },
                cmd: false,
                args: ['grunt', '--gruntfile', 'app/Gruntfile.js', 'mochaTest:e2e']
            }
        }
    });


    grunt.registerTask('unitTest', ['mochaTest:unit']);

    grunt.registerTask('e2eTest', ['mochaTest:e2e']);

    grunt.registerTask('test', ['e2eTest']);

    grunt.registerTask('serve', ['express:dev', 'watch']);
    grunt.registerTask('crons', ['express:cron', 'watch']);

    grunt.registerTask('default', 'serve');

    grunt.loadNpmTasks('grunt-simple-nyc');
};
