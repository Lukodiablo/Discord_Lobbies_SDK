{
  "targets": [
    {
      "target_name": "discord_social_sdk",
      "sources": [
        "src/discord_social_sdk.cc",
        "src/discord_client.cc"
      ],
      "include_dirs": [
        "<!(node -p \"require('node-addon-api').include_dir\")",
        "<!(node find-sdk.js)/include"
      ],
      "dependencies": [
        "<!(node -p \"require('node-addon-api').gyp\")"
      ],
      "cflags": [
        "-fPIC",
        "-fexceptions",
        "-DNAPI_CPP_EXCEPTIONS"
      ],
      "cflags_cc": [
        "-std=c++17",
        "-fexceptions",
        "-DNAPI_CPP_EXCEPTIONS"
      ],
      "msvs_settings": {
        "VCCLCompilerTool": {
          "RuntimeLibrary": 2,
          "ExceptionHandling": 1,
          "AdditionalOptions": ["/std:c++17"]
        }
      },
      "msbuild_toolset": "v143",
      "conditions": [
        [
          "OS==\"win\"",
          {
            "include_dirs": [
              "<!(node find-sdk.js)/include"
            ],
            "library_dirs": [
              "<!(node find-sdk.js)/lib/release"
            ],
            "libraries": [
              "discord_partner_sdk.lib"
            ],
            "msbuild_toolset": "v143",
            "msvs_settings": {
              "VCCLCompilerTool": {
                "RuntimeLibrary": 2,
                "ExceptionHandling": 1
              }
            },
            "copies": [
              {
                "destination": "build/Release",
                "files": [
                  "<!(node find-sdk.js)/bin/release/discord_partner_sdk.dll"
                ]
              }
            ]
          }
        ],
        [
          "OS==\"mac\"",
          {
            "include_dirs": [
              "<!(node find-sdk.js)/include"
            ],
            "library_dirs": [
              "<!(node find-sdk.js)/lib/release"
            ],
            "libraries": [
              "discord_partner_sdk"
            ],
            "xcode_settings": {
              "GCC_ENABLE_CPP_RTTI": "YES",
              "GCC_ENABLE_CPP_EXCEPTIONS": "YES",
              "MACOSX_DEPLOYMENT_TARGET": "10.13"
            }
          }
        ],
        [
          "OS==\"linux\"",
          {
            "include_dirs": [
              "<!(node find-sdk.js)/include"
            ],
            "link_settings": {
              "libraries": [
                "<!(node find-sdk.js)/lib/release/libdiscord_partner_sdk.so"
              ],
              "ldflags": [
                "-Wl,-rpath,<!(pwd)/build/Release"
              ]
            }
          }
        ]
      ],
      "copies": [
        {
          "destination": "build/Release",
          "files": [
            "<!(node find-sdk.js)/lib/release/libdiscord_partner_sdk.so"
          ],
          "conditions": [["OS==\"linux\"", {}]]
        }
      ]
    }
  ]
}
