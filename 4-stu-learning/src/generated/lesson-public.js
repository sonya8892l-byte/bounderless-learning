// 此文件由 scripts/sync-lessons.mjs 自动生成，只包含学生端公开课程字段。
export default {
  "lesson_gewu_001": {
    "id": "lesson_gewu_001",
    "title": "故宫600年不积水的秘密",
    "subtitle": "故宫排水智慧 · 跨学科研学课例",
    "series": "格物",
    "seriesCode": "gewu",
    "themeTemplate": "gewu",
    "venue": "故宫博物院（中轴线区域）",
    "mapCenter": [
      116.397,
      39.918
    ],
    "duration": "6小时（含午休）",
    "grades": "小学高年级 / 初中 / 高中",
    "groupRule": "6人一组，每人一个角色",
    "level": "",
    "levelCode": "",
    "traversalMode": "sequential",
    "coreQuestion": "故宫建成600年，历经无数暴雨，为何几乎从不积水？",
    "phases": [
      {
        "id": "phase-1",
        "number": 1,
        "name": "沉浸叙事",
        "duration": "20min",
        "mode": "集体（全班）",
        "location": "集合区域（午门广场或指定教室）",
        "modules": "A06(沉浸媒体)",
        "trigger": "教师手动启动",
        "endCondition": "情境预览图已确认 + AI收集完初始猜想",
        "flow": [
          "查看\"暴雨将至\"情境预览图",
          "AI（絮絮）出场，自我介绍，建立关系",
          "AI向每个学生提问：「你觉得故宫暴雨时会积水吗？为什么？」",
          "收集学生的初始假设（C类数据：C2认知数据）",
          "引出核心问题：「600年，为什么不积水？今天我们一起找答案」",
          "完成导入任务，进入角色选择页"
        ],
        "tasks": [
          {
            "id": "phase-1-task-1",
            "roleStageId": "",
            "name": "查看\"暴雨将至\"情境图",
            "phase": "课程任务",
            "modules": "A06(沉浸媒体)",
            "tools": [
              {
                "id": "media",
                "module": "A06",
                "name": "沉浸媒体",
                "icon": "play",
                "output": "playback",
                "config": {
                  "type": "video",
                  "url": "",
                  "poster": "lessons/lesson_gewu_001/assets/videos/video-storm-coming.png",
                  "title": "暴雨将至",
                  "requireCompletion": true,
                  "posterOnly": true
                }
              }
            ],
            "requirement": "学生确认已查看情境预览图",
            "guidanceSteps": [
              "观察情境图并确认已查看"
            ],
            "steps": [
              {
                "id": "phase-1-task-1-step-1",
                "title": "查看情境预览图",
                "objective": "查看“暴雨将至”情境图，形成最初的情境感受",
                "studentAction": "观察情境图并确认已查看",
                "completionMode": "tool_result",
                "evidenceRequirement": "媒体工具返回情境图查看确认",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A06(沉浸媒体)",
                "next": "role-stage:complete",
                "tools": [
                  {
                    "id": "media",
                    "module": "A06",
                    "name": "沉浸媒体",
                    "icon": "play",
                    "output": "playback",
                    "config": {
                      "type": "video",
                      "url": "",
                      "poster": "lessons/lesson_gewu_001/assets/videos/video-storm-coming.png",
                      "title": "暴雨将至",
                      "requireCompletion": true,
                      "posterOnly": true
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "无需提交，确认查看即通过",
            "passCondition": "学生确认已查看情境预览图",
            "goals": "",
            "prerequisites": [],
            "toolType": "media",
            "image": "",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 180,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation",
            "scope": "phase",
            "phaseId": "phase-1",
            "executor": "全班"
          },
          {
            "id": "phase-1-task-2",
            "roleStageId": "",
            "name": "写下你最初的猜想",
            "phase": "课程任务",
            "modules": "A01(文字输入)",
            "tools": [
              {
                "id": "text",
                "module": "A01",
                "name": "文字表单",
                "icon": "notebook-pen",
                "output": "fields",
                "config": {
                  "fields": [
                    {
                      "id": "initial-hypothesis",
                      "label": "你的初始猜想和理由",
                      "type": "long_text",
                      "required": true,
                      "minLength": 15
                    }
                  ]
                }
              }
            ],
            "requirement": "写出是否会积水的判断，并给出至少一条理由",
            "guidanceSteps": [
              "写下你认为暴雨时故宫会不会积水，并说明至少一条理由"
            ],
            "steps": [
              {
                "id": "phase-1-task-2-step-1",
                "title": "提交初始猜想",
                "objective": "留下探究开始前的判断和一条理由，供课程结束时回看",
                "studentAction": "写下你认为暴雨时故宫会不会积水，并说明至少一条理由",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "一段包含明确判断与至少一条理由的文字；理由是否正确不影响通过",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "role-stage:complete",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "initial-hypothesis",
                          "label": "你的初始猜想和理由",
                          "type": "long_text",
                          "required": true,
                          "minLength": 15
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "ai_evaluation",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "一段文字，含判断与理由",
            "passCondition": "写出是否会积水的判断，并给出至少一条理由",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 300,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation",
            "scope": "phase",
            "phaseId": "phase-1",
            "executor": "个人"
          }
        ]
      },
      {
        "id": "phase-2",
        "number": 2,
        "name": "现场采证",
        "duration": "90min",
        "mode": "个人（按角色分散）",
        "location": "故宫各区域（由角色决定）",
        "modules": "A01(多模态采集), A02(答题), A07(扫码)",
        "trigger": "Phase 1 结束 + 教师确认",
        "endCondition": "教师手动推进 或 时间耗尽",
        "flow": [
          "AI根据角色引导学生前往目标区域（位置导航卡片）",
          "每个角色执行3个递进任务（见 roles/*.md）",
          "任务完成后获得密符字母",
          "时间银行分支任务可并行进行"
        ],
        "tasks": []
      },
      {
        "id": "phase-3",
        "number": 3,
        "name": "推理推演",
        "duration": "40min",
        "mode": "个人→小组过渡",
        "location": "指定集合区域",
        "modules": "A01(文字输入), A03(拼合搭建), A04(沙盘推演)",
        "trigger": "Phase 2 结束",
        "endCondition": "小组完成证据拼合",
        "flow": [
          "AI引导学生整理采证阶段的发现",
          "每个角色撰写\"我的发现报告\"（文字+照片）",
          "小组汇合后，用拼合工具将6个角色的发现整合",
          "尝试还原完整的故宫排水路径"
        ],
        "tasks": []
      },
      {
        "id": "phase-4",
        "number": 4,
        "name": "璇玑时刻",
        "duration": "30min",
        "mode": "小组协作",
        "location": "集合区域",
        "modules": "A04(沙盘推演), A06(沉浸媒体)",
        "trigger": "教师核对 Phase 3 后手动推进",
        "endCondition": "暴雨模拟完成",
        "flow": [
          "小组在沙盘中搭建完整水系图（基于Phase 3的拼合结果）",
          "设置暴雨参数（降水量、持续时间）",
          "运行模拟——观察水流路径",
          "AI揭示：「你们搭建的系统……能撑过暴雨吗？」",
          "播放暴雨动画验证"
        ],
        "tasks": []
      },
      {
        "id": "phase-5",
        "number": 5,
        "name": "总结汇报",
        "duration": "20min",
        "mode": "集体",
        "location": "集合区域",
        "modules": "A01(文字输入/语音)",
        "trigger": "Phase 4 结束",
        "endCondition": "教师推进",
        "flow": [
          "每组分享\"我们组的发现\"（2-3min/组）",
          "AI辅助生成组间对比（不做排名，聚焦差异）",
          "回顾初始假设——「你最初的猜想对了吗？」",
          "AI引导元认知反思：「如果再来一次，你会改变哪一步？」"
        ],
        "tasks": []
      },
      {
        "id": "phase-6",
        "number": 6,
        "name": "尾声",
        "duration": "10min",
        "mode": "个人",
        "location": "",
        "modules": "无（系统自动）",
        "trigger": "Phase 5 结束",
        "endCondition": "",
        "flow": [
          "AI生成个人学习报告预览（完整版后续推送）",
          "絮絮告别：「今天很开心陪你探索！下次见~」",
          "课程结束标记"
        ],
        "tasks": []
      }
    ],
    "roleSystem": {
      "collectionName": "治水官",
      "itemName": "身份",
      "pickerEyebrow": "{roleCount}种身份 · {roleCount}段证据",
      "pickerTitle": "选择你的{collectionName}身份",
      "pickerDescription": "每位成员领取一个本组尚未占用的系统环节。集齐{roleCount}枚{collectionItemName}后，由老师组织进入{unlockTarget}。",
      "collectionItemName": "密符",
      "collectionPanelName": "小组密符",
      "unlockTarget": "璇玑时刻",
      "phaseId": "phase-2"
    },
    "learningView": {
      "enabled": true,
      "default": "dialogue",
      "allowStudentSwitch": true
    },
    "roles": [
      {
        "id": "dragon-counter",
        "order": 1,
        "name": "数龙官",
        "question": "千龙吐水的\"千\"是虚指还是真有一千条龙？",
        "selectionDescription": "追踪螭首的形态与数量，判断“千龙吐水”的“千”究竟有多大。",
        "location": "三大殿三台（太和殿·中和殿·保和殿）",
        "geofence": "中心(116.3972, 39.9171) 半径100m",
        "type": "核心角色",
        "collectionItem": "Y",
        "collectionItemImage": "lessons/lesson_gewu_001/assets/tokens/mifu-Y.png",
        "tasks": [
          {
            "id": "task-1",
            "roleStageId": "task-1",
            "name": "观其形",
            "phase": "Phase 2 现场采证",
            "modules": "",
            "tools": [],
            "requirement": "拍照最少5张，含正面/侧面/细节",
            "guidanceSteps": [
              "选择一处可安全观察的螭首，拍摄1—2张同时包含螭首、台基边缘和周围位置的正面全景",
              "从教师指定观察点拍摄1—2张能看清螭首开口和台基连接位置的照片",
              "再拍至少3张照片，分别记录材质或纹理、出水口细节和相邻螭首的排列关系"
            ],
            "steps": [
              {
                "id": "task-1-step-1",
                "title": "拍摄螭首正面全景",
                "objective": "获得能够确认螭首及其台基位置关系的现场全景证据",
                "studentAction": "选择一处可安全观察的螭首，拍摄1—2张同时包含螭首、台基边缘和周围位置的正面全景",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少1张清楚照片；画面同时包含螭首主体与台基环境；从教师指定的安全观察点拍摄且避开其他参观者正脸",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(拍照)",
                "next": "step:task-1-step-2",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 2,
                      "accept": "image/*",
                      "recognition": "course-evidence",
                      "prompt": "请安全拍摄。让螭首、台基边缘和周围位置同时入镜。"
                    }
                  }
                ]
              },
              {
                "id": "task-1-step-2",
                "title": "记录连接方式",
                "objective": "观察螭首如何嵌入台基，并记录开口与连接结构",
                "studentAction": "从教师指定观察点拍摄1—2张能看清螭首开口和台基连接位置的照片",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少1张侧面或斜侧面照片；能够辨认螭首与台基的连接处或可见开口",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(拍照)",
                "next": "step:task-1-step-3",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 2,
                      "accept": "image/*",
                      "recognition": "course-evidence",
                      "prompt": "请安全拍摄。让螭首与台基的连接位置清楚入镜。"
                    }
                  }
                ]
              },
              {
                "id": "task-1-step-3",
                "title": "补齐形态细节",
                "objective": "用多角度细节证据描述螭首的材质、开口和排列特征",
                "studentAction": "再拍至少3张照片，分别记录材质或纹理、出水口细节和相邻螭首的排列关系",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少3张照片；三类内容中至少覆盖材质或纹理、出水口、排列关系；本任务累计不少于5张",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(拍照)",
                "next": "role-stage:task-2",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 3,
                      "maxCount": 5,
                      "accept": "image/*",
                      "recognition": "course-evidence",
                      "prompt": "请安全拍摄。分别补拍材质或纹理、开口细节、相邻螭首排列；避免重复同一画面。"
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "完成5张有效照片采集",
            "passCondition": "完成5张有效照片采集",
            "goals": "K1(排水系统构成), K3(螭首功能), S4(史料实证)",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_gewu_001/assets/tasks/chishou-front.jpg",
            "location": {
              "mode": "geofence",
              "legacyMode": "inherit_role",
              "name": "三大殿三台（太和殿·中和殿·保和殿）",
              "coordinates": [
                116.3972,
                39.9171
              ],
              "radiusMeters": 100,
              "geofence": "中心(116.3972, 39.9171) 半径100m",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "task-2",
            "roleStageId": "task-2",
            "name": "算其数",
            "phase": "Phase 2 现场采证",
            "modules": "",
            "tools": [],
            "requirement": "表单字段：[上层台基数量, 中层台基数量, 下层台基数量, 总计]",
            "guidanceSteps": [
              "观察三层台基的重复规律，选择逐个计数、分段抽样或间距估算，并写清选择理由",
              "填写上层、中层和下层的估算数量，并分别说明这些数量怎样得到",
              "计算三层总计，再比较三层大小关系和现场排列，说明这个结果为何合理或哪里仍不确定"
            ],
            "steps": [
              {
                "id": "task-2-step-1",
                "title": "选择估算策略",
                "objective": "根据现场排列特点形成可执行的估算办法",
                "studentAction": "观察三层台基的重复规律，选择逐个计数、分段抽样或间距估算，并写清选择理由",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "写明一种主要估算方法、一个现场观察依据和准备怎样复核",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:task-2-step-2",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "method",
                          "label": "主要估算方法",
                          "type": "select",
                          "options": [
                            "逐个计数",
                            "分段抽样",
                            "按间距估算",
                            "组合方法"
                          ],
                          "required": true
                        },
                        {
                          "id": "basis",
                          "label": "现场观察依据",
                          "type": "long_text",
                          "placeholder": "例如排列是否重复、哪些区域便于计数",
                          "required": true,
                          "minLength": 20
                        },
                        {
                          "id": "check",
                          "label": "准备怎样复核",
                          "type": "long_text",
                          "required": true,
                          "minLength": 15
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "task-2-step-2",
                "title": "记录三层估算",
                "objective": "分别保留三层台基的估算数据和推算依据",
                "studentAction": "填写上层、中层和下层的估算数量，并分别说明这些数量怎样得到",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "三层估算值均已填写；至少说明抽样段、重复次数、间距或逐个计数记录中的一种推算依据",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:task-2-step-3",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "upper",
                          "label": "上层估算数量",
                          "type": "number",
                          "required": true
                        },
                        {
                          "id": "middle",
                          "label": "中层估算数量",
                          "type": "number",
                          "required": true
                        },
                        {
                          "id": "lower",
                          "label": "下层估算数量",
                          "type": "number",
                          "required": true
                        },
                        {
                          "id": "calculation",
                          "label": "分层推算过程",
                          "type": "long_text",
                          "placeholder": "写明数了哪一段、怎样扩大到整层",
                          "required": true,
                          "minLength": 30
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "task-2-step-3",
                "title": "合计并做合理性检查",
                "objective": "把分层估算合成为总数，并用现场证据检查结果是否自洽",
                "studentAction": "计算三层总计，再比较三层大小关系和现场排列，说明这个结果为何合理或哪里仍不确定",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "填写总计；总计与三层数据能够对应；至少写出一条合理性检查和一项不确定性",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "role-stage:task-3",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "total",
                          "label": "三层估算总计",
                          "type": "number",
                          "required": true
                        },
                        {
                          "id": "reasonableness",
                          "label": "合理性检查",
                          "type": "long_text",
                          "placeholder": "比较三层大小、排列密度或现场范围",
                          "required": true,
                          "minLength": 25
                        },
                        {
                          "id": "uncertainty",
                          "label": "最大不确定性",
                          "type": "long_text",
                          "required": true,
                          "minLength": 15
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "提交估算值 + 说明估算方法",
            "passCondition": "提交估算值 + 说明估算方法",
            "goals": "K3(螭首功能), S1(估算计数), C1(证据意识), C4(科学精神)",
            "prerequisites": [],
            "toolType": "text",
            "image": "",
            "location": {
              "mode": "geofence",
              "legacyMode": "inherit_role",
              "name": "三大殿三台（太和殿·中和殿·保和殿）",
              "coordinates": [
                116.3972,
                39.9171
              ],
              "radiusMeters": 100,
              "geofence": "中心(116.3972, 39.9171) 半径100m",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "task-3",
            "roleStageId": "task-3",
            "name": "验其差",
            "phase": "Phase 2 现场采证 / Phase 3 推演",
            "modules": "",
            "tools": [],
            "requirement": "反思文本最少50字",
            "guidanceSteps": [
              "录入本组与另一组或本组两次估算结果，指出总数或分层数据中差异最大的一项",
              "列出至少两个具体误差来源，并说明它们可能让估算偏大还是偏小",
              "写一段不少于50字的反思，说明如果重新计数会保留什么、改变什么以及怎样验证改进是否有效"
            ],
            "steps": [
              {
                "id": "task-3-step-1",
                "title": "定位估算差异",
                "objective": "通过对比至少两次结果找到差异最明显的位置",
                "studentAction": "录入本组与另一组或本组两次估算结果，指出总数或分层数据中差异最大的一项",
                "completionMode": "tool_result",
                "evidenceRequirement": "至少有两组可比较的数据，并明确写出差异最大的一项",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:task-3-step-2",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "estimate-a",
                          "label": "结果A",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "estimate-b",
                          "label": "结果B",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "largest-gap",
                          "label": "差异最大的一项",
                          "type": "long_text",
                          "required": true,
                          "minLength": 15
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "task-3-step-2",
                "title": "分析误差来源",
                "objective": "区分观察、抽样、计算和记录环节可能产生的误差",
                "studentAction": "列出至少两个具体误差来源，并说明它们可能让估算偏大还是偏小",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少2个不同的具体误差来源；每项包含发生环节和可能影响方向",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:task-3-step-3",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "source-1",
                          "label": "误差来源1及影响",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20
                        },
                        {
                          "id": "source-2",
                          "label": "误差来源2及影响",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "task-3-step-3",
                "title": "形成改进反思",
                "objective": "根据误差分析提出下一次能够执行的改进方案",
                "studentAction": "写一段不少于50字的反思，说明如果重新计数会保留什么、改变什么以及怎样验证改进是否有效",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "不少于50字；包含具体误差来源、至少一项可执行改进和一种复核方法",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "role-stage:complete",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "reflection",
                          "label": "估算改进反思",
                          "type": "long_text",
                          "placeholder": "结合自己的数据和误差分析来写",
                          "required": true,
                          "minLength": 50,
                          "maxLength": 300
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "提交包含\"误差来源分析\"的反思",
            "passCondition": "提交包含\"误差来源分析\"的反思",
            "goals": "C3(元认知), C4(科学精神), S1(估算计数)",
            "prerequisites": [],
            "toolType": "text",
            "image": "",
            "location": {
              "mode": "geofence",
              "legacyMode": "inherit_role",
              "name": "三大殿三台（太和殿·中和殿·保和殿）",
              "coordinates": [
                116.3972,
                39.9171
              ],
              "radiusMeters": 100,
              "geofence": "中心(116.3972, 39.9171) 半径100m",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_gewu_001/assets/roles/role-card-dragon-counter.png",
        "badgeImage": "lessons/lesson_gewu_001/assets/roles/badge-dragon-counter.png"
      },
      {
        "id": "slope-surveyor",
        "order": 2,
        "name": "测坡官",
        "question": "故宫的地面是平的吗？如果不是，水往哪里流？",
        "selectionDescription": "用观察和测量判断故宫地势走向，找到雨水自然流动的方向。",
        "location": "太和殿广场至午门通道（南北轴线）",
        "geofence": "中心(116.3970, 39.9155) 半径150m",
        "type": "核心角色",
        "collectionItem": "I",
        "collectionItemImage": "lessons/lesson_gewu_001/assets/tokens/mifu-I.png",
        "tasks": [
          {
            "id": "task-1",
            "roleStageId": "task-1",
            "name": "察其势",
            "phase": "Phase 2 现场采证",
            "modules": "",
            "tools": [],
            "requirement": "拍摄至少3个位置的地面对比照",
            "guidanceSteps": [
              "在安全动线内找到一处看起来较高和一处较低的地面，各拍1张包含固定参照物的照片",
              "保持与前两张相近的拍摄高度和方向，再拍1—2张中间位置或另一处地面的照片",
              "在剖面图上标出高点、低点和一条初步水流箭头，再写明箭头对应的照片线索"
            ],
            "steps": [
              {
                "id": "task-1-step-1",
                "title": "寻找高低参照",
                "objective": "通过可见参照建立一组可能存在高差的观察点",
                "studentAction": "在安全动线内找到一处看起来较高和一处较低的地面，各拍1张包含固定参照物的照片",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少2张照片；高点和低点各1张；画面包含台阶、墙根、沟渠边缘或其他可复核参照物",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(拍照)",
                "next": "step:task-1-step-2",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 2,
                      "maxCount": 3,
                      "accept": "image/*",
                      "recognition": "course-evidence",
                      "prompt": "请安全拍摄。分别记录可能的高点和低点，并保留台阶、墙根或沟渠等固定参照。"
                    }
                  }
                ]
              },
              {
                "id": "task-1-step-2",
                "title": "补充第三观察点",
                "objective": "用第三个位置检查最初的高低判断是否只是局部错觉",
                "studentAction": "保持与前两张相近的拍摄高度和方向，再拍1—2张中间位置或另一处地面的照片",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少1张新增照片；拍摄高度和方向能够与前两张进行比较；本任务累计不少于3个位置",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(拍照)",
                "next": "step:task-1-step-3",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 2,
                      "accept": "image/*",
                      "recognition": "course-evidence",
                      "prompt": "请安全拍摄。补拍第三个位置，尽量保持与前两张相近的拍摄高度和方向。"
                    }
                  }
                ]
              },
              {
                "id": "task-1-step-3",
                "title": "标出初步流向",
                "objective": "依据照片中的高差线索提出可核验的水流方向判断",
                "studentAction": "在剖面图上标出高点、低点和一条初步水流箭头，再写明箭头对应的照片线索",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "画板包含高点、低点和至少1条方向箭头；文字说明引用台阶、沟渠、积水痕迹或建筑线中的至少一种线索",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(画板标注), A01(文字)",
                "next": "role-stage:task-2",
                "tools": [
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 520,
                      "brushColors": [
                        "#b42318",
                        "#2563eb",
                        "#1f2937"
                      ],
                      "backgroundImage": "lessons/lesson_gewu_001/assets/maps/drainage-profile.png",
                      "prompt": "在图上标出高点、低点和你判断的水流方向。"
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "clue",
                          "label": "流向判断依据",
                          "type": "long_text",
                          "placeholder": "写明对应哪张照片和哪一种高差线索",
                          "required": true,
                          "minLength": 25
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "拍照完成 + 描述观察到的高差线索",
            "passCondition": "拍照完成 + 描述观察到的高差线索",
            "goals": "K4(坡度与排水), S2(坡度与流向判断)",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_gewu_001/assets/maps/drainage-profile.png",
            "location": {
              "mode": "geofence",
              "legacyMode": "inherit_role",
              "name": "太和殿广场至午门通道（南北轴线）",
              "coordinates": [
                116.397,
                39.9155
              ],
              "radiusMeters": 150,
              "geofence": "中心(116.3970, 39.9155) 半径150m",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "task-2",
            "roleStageId": "task-2",
            "name": "量其度",
            "phase": "Phase 2 现场采证",
            "modules": "",
            "tools": [],
            "requirement": "工具：目测+步测法（或提供简易水平仪AR模拟）\n表单字段：[估测高差(m), 估测距离(m), 计算坡度(%)]",
            "guidanceSteps": [
              "记录高点和低点的位置特征，说明测量区间为何适合进行目测或步测",
              "用目测和步测记录高差与水平距离，填写单位、步数换算或其他估测依据",
              "按“高差÷水平距离×100%”计算坡度，选择水可能流向的方向，并写出一项结果不确定性"
            ],
            "steps": [
              {
                "id": "task-2-step-1",
                "title": "确定测量区间",
                "objective": "选定一组安全、可描述且能够比较的高低观测点",
                "studentAction": "记录高点和低点的位置特征，说明测量区间为何适合进行目测或步测",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "高低点都有清楚位置描述；说明安全边界；写出至少一个适合测量的理由",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:task-2-step-2",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "high-point",
                          "label": "高点位置特征",
                          "type": "long_text",
                          "required": true,
                          "minLength": 15
                        },
                        {
                          "id": "low-point",
                          "label": "低点位置特征",
                          "type": "long_text",
                          "required": true,
                          "minLength": 15
                        },
                        {
                          "id": "why",
                          "label": "区间选择与安全说明",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "task-2-step-2",
                "title": "记录高差与距离",
                "objective": "保留能够复算的高差、水平距离和测量过程",
                "studentAction": "用目测和步测记录高差与水平距离，填写单位、步数换算或其他估测依据",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "高差和距离均有数值与单位；说明步数、步长或目测参照；没有虚构精密仪器读数",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:task-2-step-3",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "height-difference",
                          "label": "估测高差（米）",
                          "type": "number",
                          "required": true
                        },
                        {
                          "id": "horizontal-distance",
                          "label": "估测水平距离（米）",
                          "type": "number",
                          "required": true
                        },
                        {
                          "id": "method",
                          "label": "步测或目测过程",
                          "type": "long_text",
                          "placeholder": "记录步数、步长换算或参照物",
                          "required": true,
                          "minLength": 30
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "task-2-step-3",
                "title": "计算坡度并判断方向",
                "objective": "用高差与距离计算坡度，并把数值与现场流向联系起来",
                "studentAction": "按“高差÷水平距离×100%”计算坡度，选择水可能流向的方向，并写出一项结果不确定性",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "坡度数值带百分号或明确单位；计算过程可复算；方向判断与所选高低点一致；包含至少一项不确定性",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "role-stage:task-3",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "slope",
                          "label": "计算坡度（%）",
                          "type": "number",
                          "required": true
                        },
                        {
                          "id": "direction",
                          "label": "水流方向判断",
                          "type": "short_text",
                          "required": true,
                          "placeholder": "从哪个观察点流向哪个观察点"
                        },
                        {
                          "id": "calculation",
                          "label": "计算过程",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20
                        },
                        {
                          "id": "uncertainty",
                          "label": "一项不确定性",
                          "type": "long_text",
                          "required": true,
                          "minLength": 15
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "正确判断坡度方向（北高南低）+ 给出估算值",
            "passCondition": "正确判断坡度方向（北高南低）+ 给出估算值",
            "goals": "K4(坡度与排水), S2(坡度判断), S1(估算), C1(证据意识)",
            "prerequisites": [],
            "toolType": "text",
            "image": "",
            "location": {
              "mode": "geofence",
              "legacyMode": "inherit_role",
              "name": "太和殿广场至午门通道（南北轴线）",
              "coordinates": [
                116.397,
                39.9155
              ],
              "radiusMeters": 150,
              "geofence": "中心(116.3970, 39.9155) 半径150m",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "task-3",
            "roleStageId": "task-3",
            "name": "析其理",
            "phase": "Phase 2 / Phase 3",
            "modules": "",
            "tools": [],
            "requirement": "画出水流方向示意图 + 文字解释坡度的排水作用",
            "guidanceSteps": [
              "在示意图上标出至少1个高点、1个低点和2处观察到的排水设施，并写上照片编号",
              "用箭头从高点经过排水设施连向低点，并把无法确认的连接标成“待核”",
              "写一段解释，说明高差如何改变水流方向、排水设施如何接住水，以及目前还有什么没有确认"
            ],
            "steps": [
              {
                "id": "task-3-step-1",
                "title": "建立高低与设施图层",
                "objective": "把分散的高低点和排水设施放入同一空间表示",
                "studentAction": "在示意图上标出至少1个高点、1个低点和2处观察到的排水设施，并写上照片编号",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "画板包含高点、低点、至少2处排水设施和对应照片编号",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(画板标注)",
                "next": "step:task-3-step-2",
                "tools": [
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 520,
                      "brushColors": [
                        "#b42318",
                        "#2563eb",
                        "#1f2937"
                      ],
                      "backgroundImage": "lessons/lesson_gewu_001/assets/maps/drainage-profile.png",
                      "prompt": "先标高点、低点和两处排水设施，再在旁边写对应照片编号。"
                    }
                  }
                ]
              },
              {
                "id": "task-3-step-2",
                "title": "连出可能水路",
                "objective": "依据重力方向把地势和排水设施连接成一条可讨论的路径",
                "studentAction": "用箭头从高点经过排水设施连向低点，并把无法确认的连接标成“待核”",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少2段连续箭头；箭头总体由高到低；推测连接与已观察连接有明确区分",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(画板标注)",
                "next": "step:task-3-step-3",
                "tools": [
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 520,
                      "brushColors": [
                        "#2563eb",
                        "#64748b",
                        "#1f2937"
                      ],
                      "backgroundImage": "lessons/lesson_gewu_001/assets/maps/drainage-profile.png",
                      "prompt": "用实线画现场能够支持的水路，用虚线或“待核”标出推测连接。"
                    }
                  }
                ]
              },
              {
                "id": "task-3-step-3",
                "title": "解释坡度作用",
                "objective": "用现场证据解释坡度怎样帮助排水，同时保留结论边界",
                "studentAction": "写一段解释，说明高差如何改变水流方向、排水设施如何接住水，以及目前还有什么没有确认",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "不少于60字；包含高差、重力流向、排水设施和至少一项未确认内容；引用至少1条现场证据",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "role-stage:complete",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "explanation",
                          "label": "坡度与排水解释",
                          "type": "long_text",
                          "placeholder": "结合你的测量、照片和示意图说明",
                          "required": true,
                          "minLength": 60,
                          "maxLength": 300
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "示意图标注正确的流向 + 文字解释逻辑通顺",
            "passCondition": "示意图标注正确的流向 + 文字解释逻辑通顺",
            "goals": "K2(设计归纳), C2(系统思维), S2(坡度判断)",
            "prerequisites": [],
            "toolType": "text",
            "image": "",
            "location": {
              "mode": "geofence",
              "legacyMode": "inherit_role",
              "name": "太和殿广场至午门通道（南北轴线）",
              "coordinates": [
                116.397,
                39.9155
              ],
              "radiusMeters": 150,
              "geofence": "中心(116.3970, 39.9155) 半径150m",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_gewu_001/assets/roles/role-card-slope-surveyor.png",
        "badgeImage": "lessons/lesson_gewu_001/assets/roles/badge-slope-surveyor.png"
      },
      {
        "id": "ditch-finder",
        "order": 3,
        "name": "寻沟官",
        "question": "屋面雨水离开屋檐后，走了一条怎样的\"地下旅程\"？",
        "selectionDescription": "寻找可见与隐藏的排水沟渠，把零散设施连接成地下排水网络。",
        "location": "东西六宫区域（御沟可见段）",
        "geofence": "中心(116.3985, 39.9185) 半径120m",
        "type": "核心角色",
        "collectionItem": "N",
        "collectionItemImage": "lessons/lesson_gewu_001/assets/tokens/mifu-N.png",
        "tasks": [
          {
            "id": "task-1",
            "roleStageId": "task-1",
            "name": "寻其踪",
            "phase": "Phase 2 现场采证",
            "modules": "",
            "tools": [],
            "requirement": "找到并拍照至少3处可见的排水设施（明沟/暗沟口/雨水篦子）",
            "guidanceSteps": [
              "在安全动线内找到第一处疑似排水设施，拍摄1张全景和1张结构细节",
              "再寻找至少1处不同位置或不同类型的排水设施，各拍1张能看清环境和结构的照片",
              "为至少3张照片填写设施类型、判断依据和周围水可能流入的方向；不能确认时标“待核”"
            ],
            "steps": [
              {
                "id": "task-1-step-1",
                "title": "确认第一处排水设施",
                "objective": "从地面、墙根或台基边缘识别一处具有排水特征的现场对象",
                "studentAction": "在安全动线内找到第一处疑似排水设施，拍摄1张全景和1张结构细节",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少2张照片；一张说明设施所在环境，一张能看清开口、沟槽、篦子或汇水边缘；从开放动线内完成",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(拍照)",
                "next": "step:task-1-step-2",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 2,
                      "maxCount": 3,
                      "accept": "image/*",
                      "recognition": "course-evidence",
                      "prompt": "请安全拍摄。先拍设施所在环境，再拍开口、沟槽或篦子等结构细节。"
                    }
                  }
                ]
              },
              {
                "id": "task-1-step-2",
                "title": "补齐不同位置证据",
                "objective": "用不同位置或不同形态的证据避免以单个对象代表整个沟渠系统",
                "studentAction": "再寻找至少1处不同位置或不同类型的排水设施，各拍1张能看清环境和结构的照片",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少1张新增照片；与第一处在位置或结构类型上存在可说明的差别；本任务累计不少于3张有效照片",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(拍照)",
                "next": "step:task-1-step-3",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 3,
                      "accept": "image/*",
                      "recognition": "course-evidence",
                      "prompt": "请安全拍摄。补拍另一处不同位置或不同形态的候选设施，并保留周围环境。"
                    }
                  }
                ]
              },
              {
                "id": "task-1-step-3",
                "title": "标注类型与来水方向",
                "objective": "把照片中的结构特征转成可核验的设施分类和流向假设",
                "studentAction": "为至少3张照片填写设施类型、判断依据和周围水可能流入的方向；不能确认时标“待核”",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少3条照片标注；每条包含照片编号、设施类型或待核、结构依据和来水方向",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "role-stage:task-2",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "record-1",
                          "label": "照片1：类型、依据与来水方向",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20
                        },
                        {
                          "id": "record-2",
                          "label": "照片2：类型、依据与来水方向",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20
                        },
                        {
                          "id": "record-3",
                          "label": "照片3：类型、依据与来水方向",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "3张有效照片 + 标注每处设施类型",
            "passCondition": "3张有效照片 + 标注每处设施类型",
            "goals": "K5(明暗沟系统), S4(史料实证), C1(证据意识)",
            "prerequisites": [],
            "toolType": "text",
            "image": "",
            "location": {
              "mode": "geofence",
              "legacyMode": "inherit_role",
              "name": "东西六宫区域（御沟可见段）",
              "coordinates": [
                116.3985,
                39.9185
              ],
              "radiusMeters": 120,
              "geofence": "中心(116.3985, 39.9185) 半径120m",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "task-2",
            "roleStageId": "task-2",
            "name": "探其网",
            "phase": "Phase 2 现场采证",
            "modules": "",
            "tools": [],
            "requirement": "画出发现的排水设施之间的连接关系\n问答：明沟和暗沟有什么区别？各有什么优势？",
            "guidanceSteps": [
              "在画板上放置至少3个设施节点，写明照片编号、所在位置和暂定类型",
              "用箭头连接至少3个节点，并在每条箭头旁写明“现场可见”或“根据高低推测”",
              "分别写出明沟和暗沟的可见特征、可能优势和局限，并引用至少一张现场照片"
            ],
            "steps": [
              {
                "id": "task-2-step-1",
                "title": "摆放设施节点",
                "objective": "把现场发现转换成具有位置和来源的网络节点",
                "studentAction": "在画板上放置至少3个设施节点，写明照片编号、所在位置和暂定类型",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少3个节点；每个节点包含照片编号和位置；不能确认的类型标“待核”",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(画板标注)",
                "next": "step:task-2-step-2",
                "tools": [
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 520,
                      "brushColors": [
                        "#2563eb",
                        "#0f766e",
                        "#1f2937"
                      ],
                      "backgroundImage": "",
                      "prompt": "把至少3处设施画成节点，旁边写照片编号、位置和暂定类型。"
                    }
                  }
                ]
              },
              {
                "id": "task-2-step-2",
                "title": "提出连接假设",
                "objective": "依据高低、开口和沟槽方向提出节点之间的连接关系",
                "studentAction": "用箭头连接至少3个节点，并在每条箭头旁写明“现场可见”或“根据高低推测”",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少2条连接箭头；形成至少3个节点的关系；每条连接标明证据状态和流向依据",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(画板标注)",
                "next": "step:task-2-step-3",
                "tools": [
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 520,
                      "brushColors": [
                        "#2563eb",
                        "#64748b",
                        "#1f2937"
                      ],
                      "backgroundImage": "",
                      "prompt": "用箭头连接节点；实线表示现场可见，虚线表示推测，并写出流向依据。"
                    }
                  }
                ]
              },
              {
                "id": "task-2-step-3",
                "title": "比较明沟与暗沟",
                "objective": "从外观、连接和维护三个角度比较明沟与暗沟",
                "studentAction": "分别写出明沟和暗沟的可见特征、可能优势和局限，并引用至少一张现场照片",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "明沟与暗沟各有一条特征；至少比较一个优势和一个局限；引用照片编号；未知部分明确标注",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "role-stage:task-3",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "open-ditch",
                          "label": "明沟：特征、优势与局限",
                          "type": "long_text",
                          "required": true,
                          "minLength": 30
                        },
                        {
                          "id": "covered-ditch",
                          "label": "暗沟：特征、优势与局限",
                          "type": "long_text",
                          "required": true,
                          "minLength": 30
                        },
                        {
                          "id": "evidence",
                          "label": "对应照片编号与依据",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "画出至少3个节点的连接关系图 + 正确区分明暗沟",
            "passCondition": "画出至少3个节点的连接关系图 + 正确区分明暗沟",
            "goals": "K5(明暗沟系统), S5(系统分级), C2(系统思维)",
            "prerequisites": [],
            "toolType": "text",
            "image": "",
            "location": {
              "mode": "geofence",
              "legacyMode": "inherit_role",
              "name": "东西六宫区域（御沟可见段）",
              "coordinates": [
                116.3985,
                39.9185
              ],
              "radiusMeters": 120,
              "geofence": "中心(116.3985, 39.9185) 半径120m",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "task-3",
            "roleStageId": "task-3",
            "name": "绘其图",
            "phase": "Phase 3 推演",
            "modules": "",
            "tools": [],
            "requirement": "绘制完整的\"院落→支沟→干沟→河\"分级排水网络图",
            "guidanceSteps": [
              "把院落地表水、支沟、干沟和河道四张卡放入对应层级",
              "在画板上画出至少3级网络和连续流向箭头，实线表示有证据支持，虚线表示待核",
              "对照现场照片检查网络图，写明两条有证据支持的连接和一条仍需核验的连接"
            ],
            "steps": [
              {
                "id": "task-3-step-1",
                "title": "完成排水层级分类",
                "objective": "理解雨水从小范围收集设施逐级进入更大通道的层级关系",
                "studentAction": "把院落地表水、支沟、干沟和河道四张卡放入对应层级",
                "completionMode": "tool_result",
                "evidenceRequirement": "4张卡全部完成分类，层级从局部集水到河道汇流排列",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(分类搭建)",
                "next": "step:task-3-step-2",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "classification",
                      "items": [
                        {
                          "id": "courtyard-water",
                          "label": "院落地表水"
                        },
                        {
                          "id": "branch-ditch",
                          "label": "支沟"
                        },
                        {
                          "id": "trunk-ditch",
                          "label": "干沟"
                        },
                        {
                          "id": "river",
                          "label": "河道"
                        }
                      ],
                      "zones": [
                        {
                          "id": "level-1",
                          "label": "第1级：局部集水"
                        },
                        {
                          "id": "level-2",
                          "label": "第2级：小范围转运"
                        },
                        {
                          "id": "level-3",
                          "label": "第3级：主通道汇集"
                        },
                        {
                          "id": "level-4",
                          "label": "第4级：河道承接"
                        }
                      ],
                      "connections": [],
                      "prompt": "把四张排水对象卡放入对应层级。"
                    }
                  }
                ]
              },
              {
                "id": "task-3-step-2",
                "title": "连接分级水路",
                "objective": "把层级分类转换成带方向的排水网络",
                "studentAction": "在画板上画出至少3级网络和连续流向箭头，实线表示有证据支持，虚线表示待核",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少3个层级、2条以上连续箭头；每条路径有流向；已知和推测使用不同线型或文字标识",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(画板标注)",
                "next": "step:task-3-step-3",
                "tools": [
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 520,
                      "brushColors": [
                        "#2563eb",
                        "#64748b",
                        "#1f2937"
                      ],
                      "backgroundImage": "",
                      "prompt": "从院落或设施节点开始，逐级连向支沟、干沟和河道；实线画已知，虚线画待核。"
                    }
                  }
                ]
              },
              {
                "id": "task-3-step-3",
                "title": "检查网络边界",
                "objective": "检验网络图是否能够解释现场证据，同时承认地下连接的不确定性",
                "studentAction": "对照现场照片检查网络图，写明两条有证据支持的连接和一条仍需核验的连接",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少引用2条现场证据；指出1条待核连接；说明待核连接还需要什么证据",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "role-stage:complete",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "supported-1",
                          "label": "有证据支持的连接1",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20
                        },
                        {
                          "id": "supported-2",
                          "label": "有证据支持的连接2",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20
                        },
                        {
                          "id": "unknown",
                          "label": "待核连接及所需证据",
                          "type": "long_text",
                          "required": true,
                          "minLength": 25
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "网络图包含3级以上层级 + 标注流向",
            "passCondition": "网络图包含3级以上层级 + 标注流向",
            "goals": "K5(明暗沟系统), K2(设计归纳), S5(系统分级), C2(系统思维)",
            "prerequisites": [],
            "toolType": "text",
            "image": "",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 1200,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_gewu_001/assets/roles/role-card-ditch-finder.png",
        "badgeImage": "lessons/lesson_gewu_001/assets/roles/badge-ditch-finder.png"
      },
      {
        "id": "river-guide",
        "order": 4,
        "name": "引河官",
        "question": "内金水河不只是装饰——它在排水系统中扮演什么角色？",
        "selectionDescription": "追踪内金水河的来路与去向，分析它在排水系统中的作用。",
        "location": "内金水河沿线（太和门前弓形段）",
        "geofence": "中心(116.3968, 39.9160) 半径80m",
        "type": "核心角色",
        "collectionItem": "S",
        "collectionItemImage": "lessons/lesson_gewu_001/assets/tokens/mifu-S.png",
        "tasks": [
          {
            "id": "task-1",
            "roleStageId": "task-1",
            "name": "追其源",
            "phase": "Phase 2 现场采证",
            "modules": "",
            "tools": [],
            "requirement": "沿河行走拍照至少4处关键节点（入水口/桥下/弯道/出水口）",
            "guidanceSteps": [
              "在老师指定的安全观察点拍摄1张河段全景，并记录你判断来水方向的依据",
              "沿老师指定路线，在桥下、弯道或岸线变化处拍摄至少2张不同节点照片",
              "再拍1张下游或出水方向照片，把至少4张照片按上游到下游排序并逐张标注位置"
            ],
            "steps": [
              {
                "id": "task-1-step-1",
                "title": "记录可观察的入水方向",
                "objective": "找到河段的一端或来水方向，并保留可定位的现场证据",
                "studentAction": "在老师指定的安全观察点拍摄1张河段全景，并记录你判断来水方向的依据",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少1张包含河道和固定参照物的全景；文字说明引用水面、河道形态、桥位或地图中的至少一种依据；从教师指定观察点完成",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(拍照), A01(文字)",
                "next": "step:task-1-step-2",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 2,
                      "accept": "image/*",
                      "recognition": "course-evidence",
                      "prompt": "请安全拍摄。让河道全景和桥、岸线等固定参照入镜。"
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "inflow-basis",
                          "label": "来水方向与判断依据",
                          "type": "long_text",
                          "required": true,
                          "minLength": 25
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "task-1-step-2",
                "title": "采集中间节点",
                "objective": "用多个中间位置观察河道路径和方向变化",
                "studentAction": "沿老师指定路线，在桥下、弯道或岸线变化处拍摄至少2张不同节点照片",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少2张照片；来自两个不同节点或呈现两种不同河道特征；每张保留可定位参照",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(拍照)",
                "next": "step:task-1-step-3",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 2,
                      "maxCount": 4,
                      "accept": "image/*",
                      "recognition": "course-evidence",
                      "prompt": "请安全拍摄。在两个不同节点记录桥下、弯道或岸线变化，并保留定位参照。"
                    }
                  }
                ]
              },
              {
                "id": "task-1-step-3",
                "title": "整理上下游序列",
                "objective": "把分散照片整理成有依据的河道路径序列",
                "studentAction": "再拍1张下游或出水方向照片，把至少4张照片按上游到下游排序并逐张标注位置",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "新增至少1张照片；本任务累计不少于4张；提交照片顺序和每张位置标注；无法确认的端点明确写“待核”",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(拍照), A01(文字)",
                "next": "role-stage:task-2",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 2,
                      "accept": "image/*",
                      "recognition": "course-evidence",
                      "prompt": "请安全拍摄。补充一个可能的后续节点，并保留岸线或桥位参照。"
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "sequence",
                          "label": "照片顺序与节点标注",
                          "type": "long_text",
                          "placeholder": "按观察顺序标注照片位置、方向依据和不确定处",
                          "required": true,
                          "minLength": 40
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "4张有效照片 + 标注上下游方向",
            "passCondition": "4张有效照片 + 标注上下游方向",
            "goals": "K5(明暗沟系统), K2(设计归纳), S2(流向判断)",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_gewu_001/assets/maps/inner-river-path.png",
            "location": {
              "mode": "geofence",
              "legacyMode": "inherit_role",
              "name": "内金水河沿线（太和门前弓形段）",
              "coordinates": [
                116.3968,
                39.916
              ],
              "radiusMeters": 80,
              "geofence": "中心(116.3968, 39.9160) 半径80m",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "task-2",
            "roleStageId": "task-2",
            "name": "测其流",
            "phase": "Phase 2 现场采证",
            "modules": "",
            "tools": [],
            "requirement": "岸上观察法估测流速（观察水面纹理、已有漂浮物或视频中的位移）\n表单：[估测河宽(m), 估测河深(m), 估测流速(m/s), 计算流量]\n允许较大误差，重在方法",
            "guidanceSteps": [
              "选择观察水面纹理、已有漂浮物经过固定参照或视频计时中的一种方法，说明观察距离、时间和站位",
              "填写河宽、河深和流速估测值，逐项注明观察或推算依据",
              "按“河宽×河深×流速”计算流量，写出单位，并选择不确定性最大的输入解释原因"
            ],
            "steps": [
              {
                "id": "task-2-step-1",
                "title": "设计安全观察方法",
                "objective": "形成可在教师指定观察点完成的流速观察方案",
                "studentAction": "选择观察水面纹理、已有漂浮物经过固定参照或视频计时中的一种方法，说明观察距离、时间和站位",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "方法可在教师指定观察点完成；包含固定参照、观察时长或距离中的至少两项",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:task-2-step-2",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "method",
                          "label": "流速观察方法",
                          "type": "long_text",
                          "required": true,
                          "minLength": 35
                        },
                        {
                          "id": "safety",
                          "label": "安全边界",
                          "type": "long_text",
                          "required": true,
                          "minLength": 15
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "task-2-step-2",
                "title": "记录宽深与流速估测",
                "objective": "获得带单位、带方法说明的河宽、河深和流速估测数据",
                "studentAction": "填写河宽、河深和流速估测值，逐项注明观察或推算依据",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "三个数值均有单位；河深明确标注为观察推测或资料值；每项至少有一个依据",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:task-2-step-3",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "width",
                          "label": "估测河宽（米）",
                          "type": "number",
                          "required": true
                        },
                        {
                          "id": "depth",
                          "label": "估测河深（米）",
                          "type": "number",
                          "required": true
                        },
                        {
                          "id": "speed",
                          "label": "估测流速（米/秒）",
                          "type": "number",
                          "required": true
                        },
                        {
                          "id": "basis",
                          "label": "三项数据的观察或推算依据",
                          "type": "long_text",
                          "required": true,
                          "minLength": 45
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "task-2-step-3",
                "title": "计算流量并识别不确定性",
                "objective": "用简化模型计算流量，并判断哪个输入最影响结果可信度",
                "studentAction": "按“河宽×河深×流速”计算流量，写出单位，并选择不确定性最大的输入解释原因",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "计算过程可复算；结果单位为立方米/秒或等价写法；指出一个最大不确定性并说明它怎样影响结果",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "role-stage:task-3",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "flow",
                          "label": "估算流量（立方米/秒）",
                          "type": "number",
                          "required": true
                        },
                        {
                          "id": "calculation",
                          "label": "计算过程与单位",
                          "type": "long_text",
                          "required": true,
                          "minLength": 25
                        },
                        {
                          "id": "uncertain-input",
                          "label": "最大不确定性及影响",
                          "type": "long_text",
                          "required": true,
                          "minLength": 25
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "给出估测方法说明 + 估测值",
            "passCondition": "给出估测方法说明 + 估测值",
            "goals": "S1(估算), S3(实验设计), C1(证据意识), C4(科学精神)",
            "prerequisites": [],
            "toolType": "text",
            "image": "",
            "location": {
              "mode": "geofence",
              "legacyMode": "inherit_role",
              "name": "内金水河沿线（太和门前弓形段）",
              "coordinates": [
                116.3968,
                39.916
              ],
              "radiusMeters": 80,
              "geofence": "中心(116.3968, 39.9160) 半径80m",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "task-3",
            "roleStageId": "task-3",
            "name": "演其变",
            "phase": "Phase 3 推演",
            "modules": "",
            "tools": [],
            "requirement": "在沙盘中设置不同降水量，观察内金水河水位变化",
            "guidanceSteps": [
              "依次运行常规降雨、中雨和暴雨三种情景，保存每轮水位、流速和溢流风险变化",
              "比较三轮记录，指出水位、流速、河道余量或下游承接中最先明显变化的一项，并引用对应轮次",
              "写出三种降雨下的河道状态变化，说明容量边界出现的条件和多余水可能去向，并标注推测部分"
            ],
            "steps": [
              {
                "id": "task-3-step-1",
                "title": "完成三轮降雨推演",
                "objective": "观察降雨负荷逐步增加时河道压力的相对变化",
                "studentAction": "依次运行常规降雨、中雨和暴雨三种情景，保存每轮水位、流速和溢流风险变化",
                "completionMode": "tool_result",
                "evidenceRequirement": "完成3轮且三种情景不重复；保留每轮指标变化记录",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A04(沙盘推演)",
                "next": "step:task-3-step-2",
                "tools": [
                  {
                    "id": "simulation",
                    "module": "A04",
                    "name": "沙盘推演",
                    "icon": "waves",
                    "output": "rounds",
                    "config": {
                      "rounds": 3,
                      "resources": {
                        "河道容量": "固定",
                        "上游来水": "随降雨增加"
                      },
                      "choices": [
                        {
                          "id": "normal",
                          "label": "常规降雨",
                          "publicFeedback": "河道处于基线状态；记录水位、流速和剩余空间。",
                          "effects": {
                            "water-level": 1,
                            "flow-speed": 1,
                            "overflow-risk": 0
                          }
                        },
                        {
                          "id": "medium",
                          "label": "中雨",
                          "publicFeedback": "来水增加；观察水位和流速中哪一项变化更明显。",
                          "effects": {
                            "water-level": 2,
                            "flow-speed": 2,
                            "overflow-risk": 1
                          }
                        },
                        {
                          "id": "storm",
                          "label": "暴雨",
                          "publicFeedback": "系统压力达到高位；检查哪个环节最先接近容量边界。",
                          "effects": {
                            "water-level": 4,
                            "flow-speed": 3,
                            "overflow-risk": 4
                          }
                        }
                      ],
                      "metrics": [
                        {
                          "id": "water-level",
                          "label": "水位压力",
                          "initial": 0,
                          "initialLabel": "基线待测"
                        },
                        {
                          "id": "flow-speed",
                          "label": "流速变化",
                          "initial": 0,
                          "initialLabel": "基线待测"
                        },
                        {
                          "id": "overflow-risk",
                          "label": "溢流风险",
                          "initial": 0,
                          "initialLabel": "未观察"
                        }
                      ],
                      "allowRepeat": false,
                      "prompt": "依次运行三种降雨情景，观察河道压力怎样变化。",
                      "roundPrompts": [
                        "第1轮：选择常规降雨，建立基线。",
                        "第2轮：选择中雨，比较指标变化。",
                        "第3轮：选择暴雨，寻找容量边界。"
                      ]
                    }
                  }
                ]
              },
              {
                "id": "task-3-step-2",
                "title": "定位最先变化的环节",
                "objective": "从三轮指标变化中识别系统压力首先出现在哪里",
                "studentAction": "比较三轮记录，指出水位、流速、河道余量或下游承接中最先明显变化的一项，并引用对应轮次",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "明确指出一个首先变化的环节；引用至少两轮数据或现象进行比较；保留其他可能解释",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:task-3-step-3",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "first-change",
                          "label": "最先明显变化的环节",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20
                        },
                        {
                          "id": "comparison",
                          "label": "对应轮次与比较证据",
                          "type": "long_text",
                          "required": true,
                          "minLength": 35
                        },
                        {
                          "id": "alternative",
                          "label": "另一种可能解释",
                          "type": "long_text",
                          "required": true,
                          "minLength": 15
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "task-3-step-3",
                "title": "说明容量边界与去向",
                "objective": "用系统关系解释河道容量有限时多余来水可能怎样转移",
                "studentAction": "写出三种降雨下的河道状态变化，说明容量边界出现的条件和多余水可能去向，并标注推测部分",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "同时描述常规、中雨、暴雨三种状态；包含容量边界条件、至少一个可能去向和一项不确定性",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "role-stage:complete",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "three-scenarios",
                          "label": "三种降雨状态对比",
                          "type": "long_text",
                          "required": true,
                          "minLength": 60
                        },
                        {
                          "id": "capacity-boundary",
                          "label": "容量边界与多余水去向",
                          "type": "long_text",
                          "required": true,
                          "minLength": 45
                        },
                        {
                          "id": "uncertainty",
                          "label": "仍需核验的内容",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "描述\"正常/中雨/暴雨\"三种情况下河道状态变化",
            "passCondition": "描述\"正常/中雨/暴雨\"三种情况下河道状态变化",
            "goals": "K2(设计归纳), C2(系统思维), S5(系统分级)",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_gewu_001/assets/videos/video-simulation.png",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 1200,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_gewu_001/assets/roles/role-card-river-guide.png",
        "badgeImage": "lessons/lesson_gewu_001/assets/roles/badge-river-guide.png"
      },
      {
        "id": "moat-guard",
        "order": 5,
        "name": "护城官",
        "question": "宽阔的护城河，除了防御还有什么隐藏功能？",
        "selectionDescription": "观察护城河结构与容量，发现它在防御之外承担的多重功能。",
        "location": "护城河沿线（东华门至午门段）",
        "geofence": "中心(116.3995, 39.9165) 半径130m",
        "type": "核心角色",
        "collectionItem": "H",
        "collectionItemImage": "lessons/lesson_gewu_001/assets/tokens/mifu-H.png",
        "tasks": [
          {
            "id": "task-1",
            "roleStageId": "task-1",
            "name": "观其堤",
            "phase": "Phase 2 现场采证",
            "modules": "",
            "tools": [],
            "requirement": "拍照河堤结构、排水口、水位标记至少4处",
            "guidanceSteps": [
              "在老师指定的安全观察点拍摄1—2张河堤和水面全景，保留城墙、岸线或桥位参照",
              "再拍至少3张照片，分别寻找排水口、岸壁结构、水位痕迹或其他可说明水位变化的细节",
              "选择至少3张照片，分别填写结构类型、可见特征和可能作用；证据不足时使用“可能”或“待核”"
            ],
            "steps": [
              {
                "id": "task-1-step-1",
                "title": "记录河堤整体结构",
                "objective": "获得能够说明河堤轮廓、岸线与水体关系的现场全景",
                "studentAction": "在老师指定的安全观察点拍摄1—2张河堤和水面全景，保留城墙、岸线或桥位参照",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少1张清楚全景；画面同时包含河堤和水体，并有可定位参照；从教师指定观察点完成",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(拍照)",
                "next": "step:task-1-step-2",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 2,
                      "accept": "image/*",
                      "recognition": "course-evidence",
                      "prompt": "请安全拍摄。记录河堤与水体的整体关系，并保留城墙、岸线或桥位参照。"
                    }
                  }
                ]
              },
              {
                "id": "task-1-step-2",
                "title": "补齐排水与水位证据",
                "objective": "观察河堤上可能与进排水或水位变化有关的细节",
                "studentAction": "再拍至少3张照片，分别寻找排水口、岸壁结构、水位痕迹或其他可说明水位变化的细节",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少3张新增照片；至少覆盖两类不同结构或痕迹；本任务累计不少于4张；不确定对象标“待核”",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(拍照)",
                "next": "step:task-1-step-3",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 3,
                      "maxCount": 5,
                      "accept": "image/*",
                      "recognition": "course-evidence",
                      "prompt": "请安全拍摄。补拍开口、岸壁结构或水位痕迹，避免重复同一画面。"
                    }
                  }
                ]
              },
              {
                "id": "task-1-step-3",
                "title": "分类并提出功能假设",
                "objective": "把河堤照片分类，并用结构证据提出谨慎的功能解释",
                "studentAction": "选择至少3张照片，分别填写结构类型、可见特征和可能作用；证据不足时使用“可能”或“待核”",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少3条照片记录；每条包含照片编号、可见特征和功能假设；观察事实与推测表达清楚区分",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "role-stage:task-2",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "record-1",
                          "label": "照片1：结构、特征与可能作用",
                          "type": "long_text",
                          "required": true,
                          "minLength": 25
                        },
                        {
                          "id": "record-2",
                          "label": "照片2：结构、特征与可能作用",
                          "type": "long_text",
                          "required": true,
                          "minLength": 25
                        },
                        {
                          "id": "record-3",
                          "label": "照片3：结构、特征与可能作用",
                          "type": "long_text",
                          "required": true,
                          "minLength": 25
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "4张有效照片 + 描述观察到的结构特征",
            "passCondition": "4张有效照片 + 描述观察到的结构特征",
            "goals": "K6(护城河水量调节), S4(史料实证), C1(证据意识)",
            "prerequisites": [],
            "toolType": "text",
            "image": "",
            "location": {
              "mode": "geofence",
              "legacyMode": "inherit_role",
              "name": "护城河沿线（东华门至午门段）",
              "coordinates": [
                116.3995,
                39.9165
              ],
              "radiusMeters": 130,
              "geofence": "中心(116.3995, 39.9165) 半径130m",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "task-2",
            "roleStageId": "task-2",
            "name": "验其深",
            "phase": "Phase 2 现场采证",
            "modules": "",
            "tools": [],
            "requirement": "步测法估测河宽 + 观察法推测河深\n表单：[估测河宽(m), 估测深度(m), 估测周长(m), 计算蓄水体积]\n引导计算蓄水量（简化为矩形截面×周长）",
            "guidanceSteps": [
              "在教师指定的安全路线记录步数、个人步长或地图比例，计算一处河宽估测值",
              "根据可见岸壁、课程材料或地图记录河深和周长估测值，并逐项标注“观察推测”或“资料值”",
              "按“河宽×河深×周长”计算简化蓄水量，写出计算过程、单位和模型可能造成的偏差"
            ],
            "steps": [
              {
                "id": "task-2-step-1",
                "title": "估测河宽",
                "objective": "用步测或地图比例形成可复算的河宽估测",
                "studentAction": "在教师指定的安全路线记录步数、个人步长或地图比例，计算一处河宽估测值",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "包含河宽数值和单位；写明步数与步长或地图比例；说明测量路线的安全边界",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:task-2-step-2",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "width",
                          "label": "估测河宽（米）",
                          "type": "number",
                          "required": true
                        },
                        {
                          "id": "method",
                          "label": "步数、步长或地图比例换算",
                          "type": "long_text",
                          "required": true,
                          "minLength": 30
                        },
                        {
                          "id": "safety",
                          "label": "安全边界说明",
                          "type": "long_text",
                          "required": true,
                          "minLength": 15
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "task-2-step-2",
                "title": "建立深度与长度假设",
                "objective": "为无法直接测量的河深和周长建立有来源的估算假设",
                "studentAction": "根据可见岸壁、课程材料或地图记录河深和周长估测值，并逐项标注“观察推测”或“资料值”",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "河深与周长均有数值和单位；每项标明数据性质和依据；不得把推测写成现场实测",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:task-2-step-3",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "depth",
                          "label": "估测河深（米）",
                          "type": "number",
                          "required": true
                        },
                        {
                          "id": "perimeter",
                          "label": "估测周长（米）",
                          "type": "number",
                          "required": true
                        },
                        {
                          "id": "sources",
                          "label": "数据性质与估算依据",
                          "type": "long_text",
                          "required": true,
                          "minLength": 40
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "task-2-step-3",
                "title": "估算蓄水量级",
                "objective": "用简化截面模型估算护城河蓄水量，并检查量级和单位",
                "studentAction": "按“河宽×河深×周长”计算简化蓄水量，写出计算过程、单位和模型可能造成的偏差",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "计算式使用本组前三项数据；结果单位为立方米；能够判断结果所在数量级；至少说明一个简化假设",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "role-stage:task-3",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "volume",
                          "label": "估算蓄水量（立方米）",
                          "type": "number",
                          "required": true
                        },
                        {
                          "id": "calculation",
                          "label": "计算过程与数量级",
                          "type": "long_text",
                          "required": true,
                          "minLength": 30
                        },
                        {
                          "id": "assumption",
                          "label": "模型简化与可能偏差",
                          "type": "long_text",
                          "required": true,
                          "minLength": 25
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "给出蓄水量量级估算（万级m³即可）",
            "passCondition": "给出蓄水量量级估算（万级m³即可）",
            "goals": "K6(护城河), S1(估算), C1(证据意识), C4(科学精神)",
            "prerequisites": [],
            "toolType": "text",
            "image": "",
            "location": {
              "mode": "geofence",
              "legacyMode": "inherit_role",
              "name": "护城河沿线（东华门至午门段）",
              "coordinates": [
                116.3995,
                39.9165
              ],
              "radiusMeters": 130,
              "geofence": "中心(116.3995, 39.9165) 半径130m",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "task-3",
            "roleStageId": "task-3",
            "name": "解其用",
            "phase": "Phase 2 / Phase 3",
            "modules": "",
            "tools": [],
            "requirement": "问答：护城河可能承担哪些不同功能？请至少提出3项主张\n文字：解释蓄存与排放怎样配合，以及依赖哪些条件",
            "guidanceSteps": [
              "列出至少3个不同功能，并分别用一句话说明该功能解决什么问题",
              "为三个功能各匹配一条照片、计算结果或课程材料，并标明证据来源和强弱",
              "结合自己的量级估算和路径证据，解释蓄存、排放和容量之间的关系，并说明成立条件"
            ],
            "steps": [
              {
                "id": "task-3-step-1",
                "title": "提出三个功能主张",
                "objective": "从现场结构和课程材料中识别护城河可能承担的多重功能",
                "studentAction": "列出至少3个不同功能，并分别用一句话说明该功能解决什么问题",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少3个功能；功能之间含义不重复；每项包含所解决的问题；允许写“待核”主张",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:task-3-step-2",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "function-1",
                          "label": "功能1及解决的问题",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20
                        },
                        {
                          "id": "function-2",
                          "label": "功能2及解决的问题",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20
                        },
                        {
                          "id": "function-3",
                          "label": "功能3及解决的问题",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "task-3-step-2",
                "title": "为功能匹配证据",
                "objective": "用现场观察或资料来源支持每一个功能主张",
                "studentAction": "为三个功能各匹配一条照片、计算结果或课程材料，并标明证据来源和强弱",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "3条功能均有对应证据；每条写明来源；能够区分现场一手证据与课程资料",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:task-3-step-3",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "evidence-1",
                          "label": "功能1的证据与来源",
                          "type": "long_text",
                          "required": true,
                          "minLength": 25
                        },
                        {
                          "id": "evidence-2",
                          "label": "功能2的证据与来源",
                          "type": "long_text",
                          "required": true,
                          "minLength": 25
                        },
                        {
                          "id": "evidence-3",
                          "label": "功能3的证据与来源",
                          "type": "long_text",
                          "required": true,
                          "minLength": 25
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "task-3-step-3",
                "title": "解释蓄存与排放的关系",
                "objective": "解释临时承接能力与后续排放怎样共同影响系统表现",
                "studentAction": "结合自己的量级估算和路径证据，解释蓄存、排放和容量之间的关系，并说明成立条件",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "不少于60字；包含来水增加、暂时蓄存、下游排放和容量有限四个关系；引用至少一项本组数据或照片",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "role-stage:complete",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "storage-discharge",
                          "label": "蓄存与排放关系",
                          "type": "long_text",
                          "placeholder": "结合你的估算和现场证据说明",
                          "required": true,
                          "minLength": 60,
                          "maxLength": 320
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "列出≥3个有证据支持的功能 + 解释蓄存与排放的关系",
            "passCondition": "列出≥3个有证据支持的功能 + 解释蓄存与排放的关系",
            "goals": "K6(护城河), K2(设计归纳), C2(系统思维), C5(文化认同)",
            "prerequisites": [],
            "toolType": "text",
            "image": "",
            "location": {
              "mode": "geofence",
              "legacyMode": "inherit_role",
              "name": "护城河沿线（东华门至午门段）",
              "coordinates": [
                116.3995,
                39.9165
              ],
              "radiusMeters": 130,
              "geofence": "中心(116.3995, 39.9165) 半径130m",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_gewu_001/assets/roles/role-card-moat-guard.png",
        "badgeImage": "lessons/lesson_gewu_001/assets/roles/badge-moat-guard.png"
      },
      {
        "id": "truth-seeker",
        "order": 6,
        "name": "真相官",
        "question": "600年不积水——这是事实、传说、还是有条件的结论？",
        "selectionDescription": "汇总并核验多方证据，为“600年不积水”形成有条件的结论。",
        "location": "机动（跟随其他角色采集二手证据 + 独立调研区域）",
        "geofence": "中心(116.3970, 39.9170) 半径200m（较大范围）",
        "type": "整合角色",
        "collectionItem": "U",
        "collectionItemImage": "lessons/lesson_gewu_001/assets/tokens/mifu-U.png",
        "tasks": [
          {
            "id": "task-1",
            "roleStageId": "task-1",
            "name": "汇其证",
            "phase": "Phase 2 现场采证",
            "modules": "",
            "tools": [],
            "requirement": "收集至少5条来自不同角色的\"证据摘要\"\n扫描其他角色完成任务后生成的证据二维码\n每条证据标注来源（哪个角色、什么方法获得）",
            "guidanceSteps": [
              "至少扫码获取1条角色证据，再把共计不少于5条证据摘要录入协作账本并标明贡献角色",
              "按证据编号整理至少5条来源，逐条写明角色、地点、获取方法和对应照片或记录编号",
              "把5张证据卡分到“一手证据”“二手证据”或“暂无法判断”，并写出一条分类原则"
            ],
            "steps": [
              {
                "id": "task-1-step-1",
                "title": "建立跨角色证据账本",
                "objective": "从不同角色取得至少5条可追溯的证据摘要",
                "studentAction": "至少扫码获取1条角色证据，再把共计不少于5条证据摘要录入协作账本并标明贡献角色",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "完成至少1次扫码；账本不少于5条；每条包含贡献角色和简短证据摘要；不得索取其他角色的完整答案或最终结论",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A07(二维码), A05(证据汇总)",
                "next": "step:task-1-step-2",
                "tools": [
                  {
                    "id": "scanner",
                    "module": "A07",
                    "name": "扫码识别",
                    "icon": "scan-line",
                    "output": "scanResult",
                    "config": {
                      "mode": "qr",
                      "allowManualEntry": true,
                      "prompt": "扫描其他角色完成任务后生成的证据摘要二维码；只收集证据摘要。"
                    }
                  },
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "evidence_log",
                      "prompt": "记录至少5条来自不同角色或不同方法的证据摘要，并标明贡献角色。",
                      "minimumEntries": 5,
                      "roles": [
                        "数龙官",
                        "测坡官",
                        "寻沟官",
                        "引河官",
                        "护城官",
                        "真相官"
                      ],
                      "recordTypes": [
                        "现场照片",
                        "测量数据",
                        "观察记录",
                        "角色摘要"
                      ]
                    }
                  }
                ]
              },
              {
                "id": "task-1-step-2",
                "title": "补齐来源元数据",
                "objective": "让每条证据都能回到具体角色、地点和获取方法进行复查",
                "studentAction": "按证据编号整理至少5条来源，逐条写明角色、地点、获取方法和对应照片或记录编号",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少5条编号记录；每条均包含角色、地点、方法和证据编号；缺失信息明确写“待补”",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:task-1-step-3",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "source-1",
                          "label": "证据1来源记录",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20
                        },
                        {
                          "id": "source-2",
                          "label": "证据2来源记录",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20
                        },
                        {
                          "id": "source-3",
                          "label": "证据3来源记录",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20
                        },
                        {
                          "id": "source-4",
                          "label": "证据4来源记录",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20
                        },
                        {
                          "id": "source-5",
                          "label": "证据5来源记录",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "task-1-step-3",
                "title": "区分一手与二手证据",
                "objective": "根据证据获得方式区分自己直接观察与他人转述",
                "studentAction": "把5张证据卡分到“一手证据”“二手证据”或“暂无法判断”，并写出一条分类原则",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "5张证据卡全部分类；允许使用“暂无法判断”；分类原则能够说明直接观察、他人提供和来源不清的区别",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(分类搭建), A01(文字)",
                "next": "role-stage:task-2",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "classification",
                      "items": [
                        {
                          "id": "evidence-1",
                          "label": "证据1"
                        },
                        {
                          "id": "evidence-2",
                          "label": "证据2"
                        },
                        {
                          "id": "evidence-3",
                          "label": "证据3"
                        },
                        {
                          "id": "evidence-4",
                          "label": "证据4"
                        },
                        {
                          "id": "evidence-5",
                          "label": "证据5"
                        }
                      ],
                      "zones": [
                        {
                          "id": "first-hand",
                          "label": "一手证据：自己直接获得"
                        },
                        {
                          "id": "second-hand",
                          "label": "二手证据：他人提供"
                        },
                        {
                          "id": "unclear",
                          "label": "暂无法判断"
                        }
                      ],
                      "connections": [],
                      "prompt": "根据自己的证据账本，把5条证据按获得方式分类。"
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "rule",
                          "label": "你的分类原则",
                          "type": "long_text",
                          "required": true,
                          "minLength": 30
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "收集≥5条 + 每条有来源标注",
            "passCondition": "收集≥5条 + 每条有来源标注",
            "goals": "S4(史料实证), S6(信息整合), C1(证据意识)",
            "prerequisites": [],
            "toolType": "text",
            "image": "",
            "location": {
              "mode": "geofence",
              "legacyMode": "inherit_role",
              "name": "机动（跟随其他角色采集二手证据 + 独立调研区域）",
              "coordinates": [
                116.397,
                39.917
              ],
              "radiusMeters": 200,
              "geofence": "中心(116.3970, 39.9170) 半径200m（较大范围）",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "task-2",
            "roleStageId": "task-2",
            "name": "辨其伪",
            "phase": "Phase 2 / Phase 3",
            "modules": "",
            "tools": [],
            "requirement": "对每条证据做可信度评级（强/中/弱）\n问答：\"600年不积水\"这个说法精确吗？有没有反例？\n提供一则故宫局部积水的公开报道（AI适时出示）",
            "guidanceSteps": [
              "把5张证据卡分为强、中、弱或待核，并写出你使用的三个评级标准",
              "用已收集证据分析“600年不积水”需要在哪些降雨、维护、区域和时间条件下才可能成立",
              "阅读絮絮在本步解锁的局部积水材料，写出修正后的结论，并说明哪些原判断保留、哪些需要收窄"
            ],
            "steps": [
              {
                "id": "task-2-step-1",
                "title": "评定证据强弱",
                "objective": "依据来源、方法和可复核性评定证据强度",
                "studentAction": "把5张证据卡分为强、中、弱或待核，并写出你使用的三个评级标准",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "5张卡全部评级；允许使用“待核”；评级标准至少覆盖来源、获取方法和能否复核",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(分类搭建), A01(文字)",
                "next": "step:task-2-step-2",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "classification",
                      "items": [
                        {
                          "id": "evidence-1",
                          "label": "证据1"
                        },
                        {
                          "id": "evidence-2",
                          "label": "证据2"
                        },
                        {
                          "id": "evidence-3",
                          "label": "证据3"
                        },
                        {
                          "id": "evidence-4",
                          "label": "证据4"
                        },
                        {
                          "id": "evidence-5",
                          "label": "证据5"
                        }
                      ],
                      "zones": [
                        {
                          "id": "strong",
                          "label": "强证据"
                        },
                        {
                          "id": "medium",
                          "label": "中等证据"
                        },
                        {
                          "id": "weak",
                          "label": "弱证据"
                        },
                        {
                          "id": "pending",
                          "label": "待核"
                        }
                      ],
                      "connections": [],
                      "prompt": "依据来源、获取方法和可复核性，为5条证据评级。"
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "criteria",
                          "label": "评级标准",
                          "type": "long_text",
                          "required": true,
                          "minLength": 45
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "task-2-step-2",
                "title": "写出主张成立条件",
                "objective": "把绝对化口号拆成可以被证据检验的条件性主张",
                "studentAction": "用已收集证据分析“600年不积水”需要在哪些降雨、维护、区域和时间条件下才可能成立",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少提出3项成立条件；引用至少2条已评级证据；区分“未发现积水证据”和“从未积水”",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:task-2-step-3",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "conditions",
                          "label": "主张成立所需条件",
                          "type": "long_text",
                          "required": true,
                          "minLength": 70
                        },
                        {
                          "id": "evidence-links",
                          "label": "对应证据编号与等级",
                          "type": "long_text",
                          "required": true,
                          "minLength": 30
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "task-2-step-3",
                "title": "用反例修正结论",
                "objective": "理解反例不会抹去系统价值，但会限定结论的适用范围",
                "studentAction": "阅读絮絮在本步解锁的局部积水材料，写出修正后的结论，并说明哪些原判断保留、哪些需要收窄",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "修正结论包含适用条件和边界；引用局部积水反例；同时说明排水系统仍有何能力；不把单个反例扩大成“系统完全无效”",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "role-stage:task-3",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "revised-claim",
                          "label": "修正后的条件性结论",
                          "type": "long_text",
                          "required": true,
                          "minLength": 70
                        },
                        {
                          "id": "kept-and-revised",
                          "label": "保留了什么、收窄了什么",
                          "type": "long_text",
                          "required": true,
                          "minLength": 40
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "完成证据评级 + 对\"600年不积水\"给出带条件的判断",
            "passCondition": "完成证据评级 + 对\"600年不积水\"给出带条件的判断",
            "goals": "C4(科学精神), C1(证据意识), S4(史料实证)",
            "prerequisites": [],
            "toolType": "text",
            "image": "",
            "location": {
              "mode": "geofence",
              "legacyMode": "inherit_role",
              "name": "机动（跟随其他角色采集二手证据 + 独立调研区域）",
              "coordinates": [
                116.397,
                39.917
              ],
              "radiusMeters": 200,
              "geofence": "中心(116.3970, 39.9170) 半径200m（较大范围）",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "task-3",
            "roleStageId": "task-3",
            "name": "断其案",
            "phase": "Phase 3 推演",
            "modules": "",
            "tools": [],
            "requirement": "撰写\"真相报告\"——总结排水系统的真实能力和边界",
            "guidanceSteps": [
              "把五张角色证据卡分别放入快速排出、重力驱动、沟渠转运、河道汇流和终端蓄排五个环节",
              "选择至少3条强或中等证据，分别说明系统能力、适用条件和证据来源",
              "撰写真相报告，回答排水系统为何有效、在哪些条件下有效、已知局限是什么，以及“600年不积水”应怎样准确表达"
            ],
            "steps": [
              {
                "id": "task-3-step-1",
                "title": "拼合五条系统证据",
                "objective": "把五个角色的证据放回排水系统的不同功能环节",
                "studentAction": "把五张角色证据卡分别放入快速排出、重力驱动、沟渠转运、河道汇流和终端蓄排五个环节",
                "completionMode": "tool_result",
                "evidenceRequirement": "5张角色卡全部完成匹配，形成从局部排水到终端承接的功能链",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(证据拼合)",
                "next": "step:task-3-step-2",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "classification",
                      "items": [
                        {
                          "id": "dragon",
                          "label": "数龙官证据"
                        },
                        {
                          "id": "slope",
                          "label": "测坡官证据"
                        },
                        {
                          "id": "ditch",
                          "label": "寻沟官证据"
                        },
                        {
                          "id": "river",
                          "label": "引河官证据"
                        },
                        {
                          "id": "moat",
                          "label": "护城官证据"
                        }
                      ],
                      "zones": [
                        {
                          "id": "rapid-release",
                          "label": "快速排出"
                        },
                        {
                          "id": "gravity",
                          "label": "重力驱动"
                        },
                        {
                          "id": "transfer",
                          "label": "沟渠转运"
                        },
                        {
                          "id": "river-collection",
                          "label": "河道汇流"
                        },
                        {
                          "id": "terminal-storage",
                          "label": "终端蓄排"
                        }
                      ],
                      "connections": [],
                      "prompt": "把五个角色的证据贡献放入对应系统功能环节。"
                    }
                  }
                ]
              },
              {
                "id": "task-3-step-2",
                "title": "总结能力与有效条件",
                "objective": "用强证据说明排水系统能够做什么，以及这些能力依赖哪些条件",
                "studentAction": "选择至少3条强或中等证据，分别说明系统能力、适用条件和证据来源",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少3条证据；覆盖至少3个系统环节；每条包含证据编号、证据等级、支持的能力和成立条件",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:task-3-step-3",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "ability-1",
                          "label": "能力证据1",
                          "type": "long_text",
                          "required": true,
                          "minLength": 30
                        },
                        {
                          "id": "ability-2",
                          "label": "能力证据2",
                          "type": "long_text",
                          "required": true,
                          "minLength": 30
                        },
                        {
                          "id": "ability-3",
                          "label": "能力证据3",
                          "type": "long_text",
                          "required": true,
                          "minLength": 30
                        },
                        {
                          "id": "conditions",
                          "label": "共同有效条件",
                          "type": "long_text",
                          "required": true,
                          "minLength": 45
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "task-3-step-3",
                "title": "提交带边界的真相报告",
                "objective": "形成同时包含系统成效、局限、反例和条件的最终结论",
                "studentAction": "撰写真相报告，回答排水系统为何有效、在哪些条件下有效、已知局限是什么，以及“600年不积水”应怎样准确表达",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "不少于150字；包含系统能力总结、至少3条证据、已知局限或反例、适用条件和最终条件性结论",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "role-stage:complete",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "truth-report",
                          "label": "故宫排水真相报告",
                          "type": "long_text",
                          "placeholder": "用证据说明能力，也写清局限和适用条件",
                          "required": true,
                          "minLength": 150,
                          "maxLength": 800
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "报告包含：系统能力总结 + 已知局限 + 带条件的结论",
            "passCondition": "报告包含：系统能力总结 + 已知局限 + 带条件的结论",
            "goals": "C4(科学精神), C2(系统思维), S6(信息整合), C5(文化认同)",
            "prerequisites": [],
            "toolType": "text",
            "image": "",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 1200,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_gewu_001/assets/roles/role-card-truth-seeker.png",
        "badgeImage": "lessons/lesson_gewu_001/assets/roles/badge-truth-seeker.png"
      }
    ],
    "timeBank": {
      "enabled": true,
      "initialBalance": 0,
      "currencyUnit": "分钟",
      "earnRules": {
        "maxTotal": 15,
        "maxPerTask": 3,
        "tasksVisibleAtOnce": 3
      },
      "giftRules": {
        "allowGiftToSelf": false,
        "maxPerAction": 5,
        "minAmount": 1,
        "target": "same_group_only"
      },
      "tasks": [
        {
          "id": "tb-01",
          "type": "quiz",
          "question": "开国大典礼炮几响？",
          "options": [
            "21",
            "28",
            "54"
          ],
          "answerType": "",
          "hint": "和一个历史事件的年份有关",
          "reward": 2,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-02",
          "type": "quiz",
          "question": "故宫一共有多少间房屋？（传说数字）",
          "options": [
            "8888",
            "9999",
            "9999.5"
          ],
          "answerType": "",
          "hint": "比天帝的万间少半间",
          "reward": 2,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-03",
          "type": "quiz",
          "question": "午门有几个门洞？",
          "options": [
            "3",
            "5",
            "7"
          ],
          "answerType": "",
          "hint": "",
          "reward": 1,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-04",
          "type": "quiz",
          "question": "太和殿屋脊上有几只走兽？（是所有古建筑中最多的）",
          "options": [
            "9",
            "10",
            "11"
          ],
          "answerType": "",
          "hint": "一般最多9只，太和殿破例多加了1只",
          "reward": 2,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-05",
          "type": "photo_checkpoint",
          "question": "找到一口铜缸并拍照",
          "options": [],
          "answerType": "",
          "hint": "太和殿前广场两侧找找看",
          "reward": 3,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-06",
          "type": "photo_checkpoint",
          "question": "找到日晷（古代计时器）并拍照",
          "options": [],
          "answerType": "",
          "hint": "太和殿前月台上",
          "reward": 2,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-07",
          "type": "photo_checkpoint",
          "question": "拍一张内金水河上的石桥",
          "options": [],
          "answerType": "",
          "hint": "太和门前有5座",
          "reward": 2,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-08",
          "type": "location_checkin",
          "question": "到达九龙壁前签到",
          "options": [],
          "answerType": "",
          "hint": "",
          "reward": 2,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-09",
          "type": "location_checkin",
          "question": "到达御花园入口签到",
          "options": [],
          "answerType": "",
          "hint": "",
          "reward": 2,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-10",
          "type": "quiz",
          "question": "你觉得故宫排水最关键的一个设计是什么？（开放题，任何合理回答均可）",
          "options": [],
          "answerType": "open_ended",
          "hint": "",
          "reward": 3,
          "unlockAfter": "phase3-start",
          "minLength": 20,
          "requiresText": false
        }
      ]
    },
    "assets": {
      "cover": "lessons/lesson_gewu_001/assets/backgrounds/cover.png",
      "chat": "lessons/lesson_gewu_001/assets/backgrounds/chat-bg.png",
      "transition": "lessons/lesson_gewu_001/assets/backgrounds/phase-transition.png",
      "certificate": "lessons/lesson_gewu_001/assets/backgrounds/certificate-bg.png",
      "navigationMap": "lessons/lesson_gewu_001/assets/maps/navigation-map.png",
      "importPlaceholder": "lessons/lesson_gewu_001/assets/videos/video-storm-coming.png",
      "simulationPlaceholder": "lessons/lesson_gewu_001/assets/videos/video-simulation.png"
    }
  },
  "lesson_zhizhi_001": {
    "id": "lesson_zhizhi_001",
    "title": "万兽城议事厅Ⅰ：地球村居民ID Card",
    "subtitle": "在国家动物博物馆，用真实证据为一种动物办理“地球村居民证”",
    "series": "致知",
    "seriesCode": "zhizhi",
    "themeTemplate": "zhizhi",
    "venue": "国家动物博物馆",
    "mapCenter": null,
    "duration": "120分钟",
    "grades": "小学3—6年级 / 亲子",
    "groupRule": "6人一组，共同代言一种动物",
    "level": "大众体验版",
    "levelCode": "experience",
    "traversalMode": "sequential",
    "coreQuestion": "如果一种动物也要办理地球村居民证，我们需要用哪些证据说明它怎样生活、与谁相连，以及人类可以为它做什么？",
    "phases": [
      {
        "id": "phase-1",
        "number": 1,
        "name": "居民招募",
        "duration": "8min",
        "mode": "集体导入",
        "location": "入口集合区",
        "modules": "A06(沉浸媒体), A01(文字)",
        "trigger": "教师手动启动",
        "endCondition": "每组领取物种并提交3个问题",
        "flow": [
          "观看“万兽城换发居民证”任务邀请。",
          "每组领取一种动物剪影与候选点位。",
          "学生写下三个真正想查明的问题。",
          "絮絮说明四类信息：观察、资料、推断、期待。"
        ],
        "tasks": [
          {
            "id": "phase-1-task-1",
            "roleStageId": "",
            "name": "确认物种并提交三个研究问题",
            "phase": "课程任务",
            "modules": "A01(文字表单)",
            "tools": [
              {
                "id": "text",
                "module": "A01",
                "name": "文字表单",
                "icon": "notebook-pen",
                "output": "fields",
                "config": {
                  "fields": [
                    {
                      "id": "species",
                      "label": "教师分配的物种",
                      "type": "short_text",
                      "required": true,
                      "minLength": 2,
                      "maxLength": 30
                    },
                    {
                      "id": "point",
                      "label": "候选展品点位",
                      "type": "short_text",
                      "required": true,
                      "minLength": 2,
                      "maxLength": 50
                    },
                    {
                      "id": "questions",
                      "label": "三个真正想查明的问题",
                      "type": "long_text",
                      "required": true,
                      "minLength": 30,
                      "maxLength": 300
                    }
                  ]
                }
              }
            ],
            "requirement": "记录教师分配的物种与候选点位，提交三个真正想查明的问题",
            "guidanceSteps": [
              "填写教师分配的物种、候选点位和三个想查明的问题"
            ],
            "steps": [
              {
                "id": "phase-1-task-1-step-1",
                "title": "提交居民招募问题卡",
                "objective": "留下角色选择前共同使用的物种、点位和问题起点",
                "studentAction": "填写教师分配的物种、候选点位和三个想查明的问题",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "物种、点位和三个可调查问题齐全",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字表单)",
                "next": "role-stage:complete",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "species",
                          "label": "教师分配的物种",
                          "type": "short_text",
                          "required": true,
                          "minLength": 2,
                          "maxLength": 30
                        },
                        {
                          "id": "point",
                          "label": "候选展品点位",
                          "type": "short_text",
                          "required": true,
                          "minLength": 2,
                          "maxLength": 50
                        },
                        {
                          "id": "questions",
                          "label": "三个真正想查明的问题",
                          "type": "long_text",
                          "required": true,
                          "minLength": 30,
                          "maxLength": 300
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "ai_evaluation",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "物种与点位明确；三个问题可通过观察或资料继续调查",
            "passCondition": "物种、候选点位和三个可调查问题齐全",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "入口集合区",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 300,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation",
            "scope": "phase",
            "phaseId": "phase-1",
            "executor": "个人"
          }
        ]
      },
      {
        "id": "phase-2",
        "number": 2,
        "name": "身份与生活取证",
        "duration": "27min",
        "mode": "角色分工 + 小组汇合",
        "location": "经踏勘确认的展品主点或替代点",
        "modules": "A07(实物识别), A01(拍照/文字)",
        "trigger": "Phase 1结束 + 教师开放角色选择页",
        "endCondition": "身份、家园和生活事实完成初审",
        "flow": [
          "确认标本与展签来源。",
          "记录物种名、学名、形态、栖息地和生活方式。",
          "每条事实绑定照片或信息卡编号。",
          "冲突或缺失信息标记“待核”，不由AI补写。"
        ],
        "tasks": []
      },
      {
        "id": "phase-3",
        "number": 3,
        "name": "关系与影响",
        "duration": "27min",
        "mode": "个人采证 + 小组拼合",
        "location": "展品点位附近允许停留区",
        "modules": "A03(拼合搭建), A01(画板/文字)",
        "trigger": "Phase 2结束",
        "endCondition": "生态关系图与人类影响链完成",
        "flow": [
          "拼出食物、天敌、伙伴和栖息地条件。",
          "用箭头说明关系方向。",
          "将人类活动分为帮助、威胁和待判断。",
          "从已有证据推导一种基本需要。"
        ],
        "tasks": []
      },
      {
        "id": "phase-4",
        "number": 4,
        "name": "角色发声",
        "duration": "32min",
        "mode": "个人创作 + 同伴核验",
        "location": "馆内安静区或教育空间",
        "modules": "A01(文字/录音), A05(同伴核验)",
        "trigger": "Phase 3结束",
        "endCondition": "60秒脚本与录音通过事实复核",
        "flow": [
          "按身份、生活、关系、影响、期待五段写脚本。",
          "同伴逐句标记证据编号和信息类型。",
          "修改无来源、过度拟人或绝对化表达。",
          "录制30—60秒真人旁白。"
        ],
        "tasks": []
      },
      {
        "id": "phase-5",
        "number": 5,
        "name": "居民证制作",
        "duration": "16min",
        "mode": "小组协作",
        "location": "教育空间",
        "modules": "A03(档案搭建), A01(文字)",
        "trigger": "Phase 4结束",
        "endCondition": "ID Card字段完整并通过人工终审",
        "flow": [
          "汇总身份、家园、生态角色、主要风险、基本需要和保障建议。",
          "检查事实、推断和期待标签。",
          "生成居民ID Card草稿。",
          "教师或引导员完成事实复核。"
        ],
        "tasks": []
      },
      {
        "id": "phase-6",
        "number": 6,
        "name": "居民发布会",
        "duration": "10min",
        "mode": "小组发布 + 个人行动",
        "location": "教育空间",
        "modules": "A05(提问), A01(文字/语音)",
        "trigger": "Phase 5结束",
        "endCondition": "完成一次证据质询和一项行动承诺",
        "flow": [
          "每组展示ID Card并播放自述。",
          "回答一个“证据在哪里”的问题。",
          "保留仍待核验的信息。",
          "每人提交一项具体、可观察、在一周内可复盘的行动。"
        ],
        "tasks": []
      }
    ],
    "roleSystem": {
      "collectionName": "居民档案官",
      "itemName": "身份",
      "pickerEyebrow": "6种分工 · 共同完成1张居民证",
      "pickerTitle": "选择你的{collectionName}身份",
      "pickerDescription": "每位成员负责一种证据。教师核对小组6类证据后，组织进入{unlockTarget}。",
      "collectionItemName": "证据章",
      "collectionPanelName": "小组证据章",
      "unlockTarget": "居民发布会",
      "phaseId": "phase-2"
    },
    "learningView": {
      "enabled": true,
      "default": "dialogue",
      "allowStudentSwitch": true
    },
    "roles": [
      {
        "id": "identity-observer",
        "order": 1,
        "name": "身份观察员",
        "question": "哪些现场特征能够帮助我们确认“它是谁”？",
        "selectionDescription": "负责确认标本身份、观察身体特征，并把“看到的”和“资料说的”分开。",
        "location": "教师分配的动物标本主点或替代点",
        "geofence": "国家动物博物馆课程允许动线",
        "type": "核心角色",
        "collectionItem": "身份章",
        "collectionItemImage": "lessons/lesson_zhizhi_001/assets/placeholders/token.svg",
        "tasks": [
          {
            "id": "identity-confirm-resident",
            "roleStageId": "identity-confirm-resident",
            "name": "确认居民",
            "phase": "Phase 2 身份与生活取证",
            "modules": "",
            "tools": [],
            "requirement": "确认标本、展签和小组物种一致，留下可复核的现场证据",
            "guidanceSteps": [
              "把标本主体和展签标题同时放入识别画面",
              "拍摄1—2张标本全景，并给照片写来源编号"
            ],
            "steps": [
              {
                "id": "identity-scan-specimen",
                "title": "识别标本",
                "objective": "确认眼前标本属于小组分配物种",
                "studentAction": "把标本主体和展签标题同时放入识别画面",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "画面包含标本主体与可定位来源的展签区域；不得拍入他人正脸",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A07(实物识别)",
                "next": "step:identity-photo-context",
                "tools": [
                  {
                    "id": "scanner",
                    "module": "A07",
                    "name": "扫码识别",
                    "icon": "scan-line",
                    "output": "scanResult",
                    "config": {
                      "mode": "object",
                      "allowManualEntry": true,
                      "prompt": "请同时拍入标本主体和展签标题区域；识别失败时保留人工记录。"
                    }
                  }
                ]
              },
              {
                "id": "identity-photo-context",
                "title": "保存身份全景",
                "objective": "获得可以复核标本身份和观察环境的图像",
                "studentAction": "拍摄1—2张标本全景，并给照片写来源编号",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少1张清楚照片和1个来源编号",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(拍照), A01(文字)",
                "next": "role-stage:identity-observe-features",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 2,
                      "accept": "image/*",
                      "recognition": "course-evidence",
                      "prompt": "拍下标本全景和展签相对位置，不拍其他参观者正脸。"
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "source-id",
                          "label": "来源编号",
                          "type": "short_text",
                          "required": true,
                          "placeholder": "例：展签01"
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "完成实物识别并提交1张同时保留标本与来源区域的照片",
            "passCondition": "完成实物识别并提交1张同时保留标本与来源区域的照片",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_001/assets/placeholders/task.svg",
            "location": {
              "mode": "point",
              "legacyMode": "point",
              "name": "教师分配的动物标本点",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "teacher",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 480,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "identity-observe-features",
            "roleStageId": "identity-observe-features",
            "name": "观察特征",
            "phase": "Phase 2 身份与生活取证",
            "modules": "",
            "tools": [],
            "requirement": "记录两个能直接观察的身体特征，并说明其可能与生活方式有什么关系",
            "guidanceSteps": [
              "在示意画板上圈出两个显著特征，并写照片编号",
              "选择一个特征，写出“我看到……所以我推测……还需用……核验”"
            ],
            "steps": [
              {
                "id": "identity-mark-features",
                "title": "圈出特征",
                "objective": "把注意力放在可直接观察的身体结构",
                "studentAction": "在示意画板上圈出两个显著特征，并写照片编号",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少2个特征标注，均能对应现场照片",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(画板标注)",
                "next": "step:identity-feature-inference",
                "tools": [
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 520,
                      "brushColors": [
                        "#2f6f5e",
                        "#c65f3d",
                        "#1f2937"
                      ],
                      "backgroundImage": "lessons/lesson_zhizhi_001/assets/placeholders/task.svg",
                      "prompt": "圈出两个你能直接看见的身体特征，并在旁边写照片编号。"
                    }
                  }
                ]
              },
              {
                "id": "identity-feature-inference",
                "title": "提出有边界的推断",
                "objective": "尝试解释结构与生活方式的关系",
                "studentAction": "选择一个特征，写出“我看到……所以我推测……还需用……核验”",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "同时包含观察、推断和核验办法",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "role-stage:identity-organize-facts",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "observation",
                          "label": "我看到",
                          "type": "long_text",
                          "required": true,
                          "minLength": 10
                        },
                        {
                          "id": "inference",
                          "label": "我推测",
                          "type": "long_text",
                          "required": true,
                          "minLength": 10
                        },
                        {
                          "id": "verify",
                          "label": "还需怎样核验",
                          "type": "long_text",
                          "required": true,
                          "minLength": 10
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "2个观察事实 + 1条明确标为推断的结构功能关系",
            "passCondition": "2个观察事实 + 1条明确标为推断的结构功能关系",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_001/assets/placeholders/task.svg",
            "location": {
              "mode": "point",
              "legacyMode": "inherit_role",
              "name": "动物标本点",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "国家动物博物馆课程允许动线",
              "verification": "none",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 600,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "identity-organize-facts",
            "roleStageId": "identity-organize-facts",
            "name": "整理身份事实",
            "phase": "Phase 5 居民证制作",
            "modules": "",
            "tools": [],
            "requirement": "向小组提交身份、显著特征和一条带边界的结构功能判断",
            "guidanceSteps": [
              "填写物种名、学名、两个显著特征及来源",
              "向小组提交身份条目，并记录一条同伴确认或待核意见"
            ],
            "steps": [
              {
                "id": "identity-submit-profile",
                "title": "填写身份条目",
                "objective": "形成可直接进入ID Card的身份资料",
                "studentAction": "填写物种名、学名、两个显著特征及来源",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "五个字段完整；看不清的学名可以写“待核”",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:identity-share-team",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "name",
                          "label": "物种名",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "scientific-name",
                          "label": "学名或待核",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "feature-1",
                          "label": "特征1",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "feature-2",
                          "label": "特征2",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "source",
                          "label": "来源编号",
                          "type": "short_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "identity-share-team",
                "title": "交给小组复核",
                "objective": "让身份资料接受同伴检查",
                "studentAction": "向小组提交身份条目，并记录一条同伴确认或待核意见",
                "completionMode": "tool_result",
                "evidenceRequirement": "至少1条身份资料和1条复核记录",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A05(团队核验)",
                "next": "role:complete",
                "tools": [
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "discussion",
                      "prompt": "核对物种名、显著特征和来源；无法确认时记录待核。",
                      "minimumEntries": 2,
                      "roles": [
                        "身份观察员",
                        "展签记录员"
                      ],
                      "recordTypes": [
                        "身份资料",
                        "确认或待核意见"
                      ],
                      "requiredRecordTypes": [
                        "身份资料",
                        "确认或待核意见"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "三项内容完整且关键事实有来源",
            "passCondition": "三项内容完整且关键事实有来源",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_001/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 480,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_zhizhi_001/assets/placeholders/role-card.svg",
        "badgeImage": "lessons/lesson_zhizhi_001/assets/placeholders/badge.svg"
      },
      {
        "id": "label-recorder",
        "order": 2,
        "name": "展签记录员",
        "question": "怎样把展签信息变成别人能够复核的事实？",
        "selectionDescription": "负责展签、来源编号和事实类型，让每条关键信息都能回到出处。",
        "location": "教师分配的动物标本点",
        "geofence": "国家动物博物馆课程允许动线",
        "type": "核心角色",
        "collectionItem": "来源章",
        "collectionItemImage": "lessons/lesson_zhizhi_001/assets/placeholders/token.svg",
        "tasks": [
          {
            "id": "label-capture-label",
            "roleStageId": "label-capture-label",
            "name": "采集展签",
            "phase": "Phase 2 身份与生活取证",
            "modules": "",
            "tools": [],
            "requirement": "拍摄或抄录展签，建立来源编号",
            "guidanceSteps": [
              "在允许拍摄时拍下展签全貌；禁止拍摄时完整抄录标题",
              "为展签建立编号，并写下访问日期"
            ],
            "steps": [
              {
                "id": "label-capture-sign",
                "title": "记录展签全貌",
                "objective": "保留展签标题和正文的上下文",
                "studentAction": "在允许拍摄时拍下展签全貌；禁止拍摄时完整抄录标题",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "照片可读或文字记录含展签标题和点位",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(拍照), A01(文字)",
                "next": "step:label-assign-source-id",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 0,
                      "maxCount": 2,
                      "accept": "image/*",
                      "recognition": "course-evidence",
                      "prompt": "拍下展签全貌，避免只拍一句话。"
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "title",
                          "label": "展签标题",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "location",
                          "label": "展厅/点位",
                          "type": "short_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "label-assign-source-id",
                "title": "建立来源编号",
                "objective": "让后续事实可以引用同一来源",
                "studentAction": "为展签建立编号，并写下访问日期",
                "completionMode": "tool_result",
                "evidenceRequirement": "编号、来源类型和日期完整",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "role-stage:label-extract-facts",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "source-id",
                          "label": "来源编号",
                          "type": "short_text",
                          "required": true,
                          "placeholder": "例：展签01"
                        },
                        {
                          "id": "source-type",
                          "label": "来源类型",
                          "type": "select",
                          "options": [
                            "标本观察",
                            "展签",
                            "馆方资料",
                            "补充知识卡"
                          ],
                          "required": true
                        },
                        {
                          "id": "date",
                          "label": "访问日期",
                          "type": "short_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "1份可读展签证据 + 1个唯一来源编号",
            "passCondition": "1份可读展签证据 + 1个唯一来源编号",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_001/assets/placeholders/task.svg",
            "location": {
              "mode": "point",
              "legacyMode": "point",
              "name": "动物标本点",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "teacher",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 480,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "label-extract-facts",
            "roleStageId": "label-extract-facts",
            "name": "提取事实",
            "phase": "Phase 2 身份与生活取证",
            "modules": "",
            "tools": [],
            "requirement": "从展签提取三条事实，不加入个人解释",
            "guidanceSteps": [
              "用自己的话写三条展签事实，每条附来源编号",
              "把六张示例卡放入四类信息区"
            ],
            "steps": [
              {
                "id": "label-extract-facts",
                "title": "填写三条事实",
                "objective": "准确转述展签信息",
                "studentAction": "用自己的话写三条展签事实，每条附来源编号",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "3条内容均能在展签找到依据，不添加情绪和想象",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:label-sort-information",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "fact-1",
                          "label": "事实1+来源",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "fact-2",
                          "label": "事实2+来源",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "fact-3",
                          "label": "事实3+来源",
                          "type": "long_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "label-sort-information",
                "title": "分类信息",
                "objective": "区分观察、资料、推断与期待",
                "studentAction": "把六张示例卡放入四类信息区",
                "completionMode": "tool_result",
                "evidenceRequirement": "六张卡全部分类",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(分类搭建)",
                "next": "role-stage:label-build-fact-pack",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "evidence-wall",
                      "items": [
                        {
                          "id": "fur-color",
                          "label": "照片显示毛色"
                        },
                        {
                          "id": "label-habitat",
                          "label": "展签写明栖息地"
                        },
                        {
                          "id": "guess-mood",
                          "label": "它看起来很难过"
                        },
                        {
                          "id": "hope-home",
                          "label": "我希望家园保持连通"
                        },
                        {
                          "id": "source-food",
                          "label": "知识卡说明食物"
                        },
                        {
                          "id": "guess-number",
                          "label": "馆里只有一件所以野外很少"
                        }
                      ],
                      "zones": [
                        {
                          "id": "observation",
                          "label": "亲眼观察"
                        },
                        {
                          "id": "source",
                          "label": "资料事实"
                        },
                        {
                          "id": "inference",
                          "label": "合理推断"
                        },
                        {
                          "id": "expectation",
                          "label": "角色期待"
                        }
                      ],
                      "connections": [],
                      "prompt": "按信息从哪里来分类。"
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "3条事实逐条绑定来源编号",
            "passCondition": "3条事实逐条绑定来源编号",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_001/assets/placeholders/task.svg",
            "location": {
              "mode": "point",
              "legacyMode": "inherit_role",
              "name": "动物标本点附近",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "国家动物博物馆课程允许动线",
              "verification": "none",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 600,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "label-build-fact-pack",
            "roleStageId": "label-build-fact-pack",
            "name": "制作事实包",
            "phase": "Phase 5 居民证制作",
            "modules": "",
            "tools": [],
            "requirement": "向小组提交三条事实、来源清单和待核项",
            "guidanceSteps": [
              "填写展签、观察和知识卡三个来源条目；没有的写“未使用”",
              "向小组提交三条事实、来源清单和一条待核项"
            ],
            "steps": [
              {
                "id": "label-build-source-list",
                "title": "汇总来源清单",
                "objective": "形成ID Card可引用的最小来源清单",
                "studentAction": "填写展签、观察和知识卡三个来源条目；没有的写“未使用”",
                "completionMode": "tool_result",
                "evidenceRequirement": "三个来源字段和访问日期完整",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:label-submit-fact-pack",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "observation",
                          "label": "观察来源",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "label",
                          "label": "展签来源",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "card",
                          "label": "知识卡来源",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "date",
                          "label": "访问日期",
                          "type": "short_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "label-submit-fact-pack",
                "title": "提交事实包",
                "objective": "让全组使用同一套可追溯事实",
                "studentAction": "向小组提交三条事实、来源清单和一条待核项",
                "completionMode": "tool_result",
                "evidenceRequirement": "至少5条团队记录，含事实、来源和待核",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A05(证据汇总)",
                "next": "role:complete",
                "tools": [
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "evidence-merge",
                      "prompt": "逐条提交事实与来源，并保留至少一条待核或证据边界。",
                      "minimumEntries": 5,
                      "roles": [
                        "展签记录员",
                        "身份观察员",
                        "ID设计员"
                      ],
                      "recordTypes": [
                        "事实",
                        "来源",
                        "待核项"
                      ],
                      "requiredRecordTypes": [
                        "事实",
                        "来源",
                        "待核项"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "事实包完整且无未标注推断",
            "passCondition": "事实包完整且无未标注推断",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_001/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 480,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_zhizhi_001/assets/placeholders/role-card.svg",
        "badgeImage": "lessons/lesson_zhizhi_001/assets/placeholders/badge.svg"
      },
      {
        "id": "ecology-mapper",
        "order": 3,
        "name": "生态关系员",
        "question": "这种动物怎样与食物、栖息地、其他生命和人类活动相连？",
        "selectionDescription": "负责寻找关系节点、画生态关系图，并解释一条人类影响链。",
        "location": "动物标本点与教育空间",
        "geofence": "国家动物博物馆课程允许动线",
        "type": "核心角色",
        "collectionItem": "关系章",
        "collectionItemImage": "lessons/lesson_zhizhi_001/assets/placeholders/token.svg",
        "tasks": [
          {
            "id": "ecology-collect-nodes",
            "roleStageId": "ecology-collect-nodes",
            "name": "收集关系节点",
            "phase": "Phase 3 关系与影响",
            "modules": "",
            "tools": [],
            "requirement": "找到食物、栖息地、其他动物和人类活动四类节点",
            "guidanceSteps": [
              "分别填写食物、栖息地条件、相关动物和人类活动",
              "把人类活动卡放到帮助、威胁或待判断区，并为一张卡写理由"
            ],
            "steps": [
              {
                "id": "ecology-collect-nodes",
                "title": "填写四类节点",
                "objective": "为关系图准备可追溯节点",
                "studentAction": "分别填写食物、栖息地条件、相关动物和人类活动",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "四个字段完整；每项附来源编号或“待核”",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:ecology-sort-human-impact",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "food",
                          "label": "食物+来源",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "habitat",
                          "label": "栖息地条件+来源",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "animal",
                          "label": "相关动物+来源/待核",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "human",
                          "label": "人类活动+来源/待核",
                          "type": "short_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "ecology-sort-human-impact",
                "title": "判断人类影响",
                "objective": "认识同一活动的影响需要条件",
                "studentAction": "把人类活动卡放到帮助、威胁或待判断区，并为一张卡写理由",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "全部卡片完成分类，至少1条带条件理由",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(分类搭建), A01(文字)",
                "next": "role-stage:ecology-draw-network",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "evidence-wall",
                      "items": [
                        {
                          "id": "reserve",
                          "label": "建设和管理保护地"
                        },
                        {
                          "id": "feeding",
                          "label": "游客投喂"
                        },
                        {
                          "id": "monitor",
                          "label": "科学监测"
                        },
                        {
                          "id": "road",
                          "label": "道路穿过栖息地"
                        },
                        {
                          "id": "rescue",
                          "label": "专业救助"
                        }
                      ],
                      "zones": [
                        {
                          "id": "help",
                          "label": "可能帮助"
                        },
                        {
                          "id": "threat",
                          "label": "可能威胁"
                        },
                        {
                          "id": "depends",
                          "label": "要看条件"
                        }
                      ],
                      "connections": [],
                      "prompt": "先分类，再允许保留待判断。",
                      "zoneMinimums": {
                        "help": 1,
                        "threat": 1,
                        "depends": 1
                      }
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "reason",
                          "label": "选择一张卡说明条件",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "四类节点各至少1项并标来源或待核",
            "passCondition": "四类节点各至少1项并标来源或待核",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_001/assets/placeholders/task.svg",
            "location": {
              "mode": "point",
              "legacyMode": "point",
              "name": "动物标本点附近",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "teacher",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 480,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "ecology-draw-network",
            "roleStageId": "ecology-draw-network",
            "name": "绘制关系网",
            "phase": "Phase 3 关系与影响",
            "modules": "",
            "tools": [],
            "requirement": "把节点连成食物、栖息地和人类影响关系网",
            "guidanceSteps": [
              "把动物放在中心，连接食物、环境、其他动物和人类活动",
              "选择一个威胁节点，写“变化—直接影响—下一步影响”"
            ],
            "steps": [
              {
                "id": "ecology-build-network",
                "title": "搭建生态关系",
                "objective": "建立多节点关系而非单条知识链",
                "studentAction": "把动物放在中心，连接食物、环境、其他动物和人类活动",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少5个节点、4条箭头，每条关系有来源或待核标签",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(关系搭建)",
                "next": "step:ecology-explain-chain",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "network",
                      "items": [
                        {
                          "id": "animal",
                          "label": "研究动物"
                        },
                        {
                          "id": "food",
                          "label": "食物"
                        },
                        {
                          "id": "habitat",
                          "label": "栖息地条件"
                        },
                        {
                          "id": "other",
                          "label": "其他动物"
                        },
                        {
                          "id": "human-help",
                          "label": "人类帮助"
                        },
                        {
                          "id": "human-threat",
                          "label": "人类威胁"
                        },
                        {
                          "id": "unknown",
                          "label": "待核关系"
                        }
                      ],
                      "zones": [
                        {
                          "id": "network",
                          "label": "生态关系网"
                        },
                        {
                          "id": "pending",
                          "label": "待核区"
                        }
                      ],
                      "connections": [],
                      "prompt": "把研究动物放在中心，用箭头连接四类节点；未知关系保留待核。",
                      "zoneMinimums": {
                        "network": 5,
                        "pending": 1
                      }
                    }
                  }
                ]
              },
              {
                "id": "ecology-explain-chain",
                "title": "解释连锁影响",
                "objective": "说明一个节点变化怎样继续影响系统",
                "studentAction": "选择一个威胁节点，写“变化—直接影响—下一步影响”",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "三段因果完整，并说明证据和不确定性",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "role-stage:ecology-propose-needs",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "change",
                          "label": "发生什么变化",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "direct",
                          "label": "直接影响",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "next",
                          "label": "下一步影响",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "boundary",
                          "label": "证据或待核点",
                          "type": "short_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "至少5个节点、4条有说明的关系和1个待核节点",
            "passCondition": "至少5个节点、4条有说明的关系和1个待核节点",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_001/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 720,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "ecology-propose-needs",
            "roleStageId": "ecology-propose-needs",
            "name": "提出基本需要",
            "phase": "Phase 5 居民证制作",
            "modules": "",
            "tools": [],
            "requirement": "从关系网推导一项基本需要和一项保障建议",
            "guidanceSteps": [
              "填写基本需要、对应证据、主要威胁和一项措施",
              "向小组提交关系图、连锁影响和需要—措施链"
            ],
            "steps": [
              {
                "id": "ecology-need-measure-chain",
                "title": "形成需要—措施链",
                "objective": "把生态理解转化为有依据的建议",
                "studentAction": "填写基本需要、对应证据、主要威胁和一项措施",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "四个字段相互对应，措施具体",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:ecology-share-map",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "need",
                          "label": "基本需要",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "evidence",
                          "label": "证据编号",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "threat",
                          "label": "主要威胁",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "measure",
                          "label": "对应措施",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "ecology-share-map",
                "title": "共享关系图",
                "objective": "让ID和自述使用同一套生态关系",
                "studentAction": "向小组提交关系图、连锁影响和需要—措施链",
                "completionMode": "tool_result",
                "evidenceRequirement": "团队记录包含关系图结论、待核点和措施",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A05(证据汇总)",
                "next": "role:complete",
                "tools": [
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "evidence-merge",
                      "prompt": "共享关系图结论，同时保留待核节点。",
                      "minimumEntries": 3,
                      "roles": [
                        "生态关系员",
                        "ID设计员",
                        "议事发言人"
                      ],
                      "recordTypes": [
                        "关系结论",
                        "待核点",
                        "需要与措施"
                      ],
                      "requiredRecordTypes": [
                        "关系结论",
                        "待核点",
                        "需要与措施"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "需要、证据、威胁和措施形成对应链",
            "passCondition": "需要、证据、威胁和措施形成对应链",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_001/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 480,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_zhizhi_001/assets/placeholders/role-card.svg",
        "badgeImage": "lessons/lesson_zhizhi_001/assets/placeholders/badge.svg"
      },
      {
        "id": "voice-recorder",
        "order": 4,
        "name": "声音记录员",
        "question": "怎样让动物“开口”，同时不替它编造经历？",
        "selectionDescription": "负责把小组证据整理成第一人称脚本，并留下真实的学生声音。",
        "location": "动物标本点与安静录音区",
        "geofence": "国家动物博物馆课程允许动线",
        "type": "核心角色",
        "collectionItem": "声音章",
        "collectionItemImage": "lessons/lesson_zhizhi_001/assets/placeholders/token.svg",
        "tasks": [
          {
            "id": "voice-select-evidence",
            "roleStageId": "voice-select-evidence",
            "name": "选择脚本证据",
            "phase": "Phase 4 角色发声",
            "modules": "",
            "tools": [],
            "requirement": "从小组证据中选出身份、生活、关系、影响和期待五类材料",
            "guidanceSteps": [
              "填写身份、生活、关系、影响和期待五栏",
              "选择最符合证据边界的表达"
            ],
            "steps": [
              {
                "id": "voice-collect-evidence",
                "title": "收集五类材料",
                "objective": "为脚本准备有来源的内容",
                "studentAction": "填写身份、生活、关系、影响和期待五栏",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "前四栏有证据编号，期待栏写明“角色期待”",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:voice-check-boundary",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "identity",
                          "label": "身份事实+编号",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "life",
                          "label": "生活事实+编号",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "relation",
                          "label": "生态关系+编号",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "impact",
                          "label": "人类影响+编号",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "expectation",
                          "label": "角色期待",
                          "type": "long_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "voice-check-boundary",
                "title": "检查叙述边界",
                "objective": "识别适合进入科学角色表达的句子",
                "studentAction": "选择最符合证据边界的表达",
                "completionMode": "tool_result",
                "evidenceRequirement": "完成选择并阅读反馈",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A02(单选)",
                "next": "role-stage:voice-record-story",
                "tools": [
                  {
                    "id": "quiz",
                    "module": "A02",
                    "name": "答题评测",
                    "icon": "list-checks",
                    "output": "answers",
                    "config": {
                      "type": "single_choice",
                      "question": "哪一句最适合进入动物第一人称脚本？",
                      "options": [
                        "我每天都在想念故乡，心里非常孤独",
                        "资料显示我依赖连通的山地森林；作为角色，我期待家园少一些阻断",
                        "我很可爱，所以人类必须先保护我"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "五类材料完整且期待与事实分开",
            "passCondition": "五类材料完整且期待与事实分开",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_001/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 480,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "voice-record-story",
            "roleStageId": "voice-record-story",
            "name": "完成自述",
            "phase": "Phase 4 角色发声",
            "modules": "",
            "tools": [],
            "requirement": "写80—150字第一人称脚本并录制30—60秒",
            "guidanceSteps": [
              "按五段结构写80—150字脚本",
              "朗读经核验的脚本，录制30—60秒旁白"
            ],
            "steps": [
              {
                "id": "voice-write-script",
                "title": "写脚本初稿",
                "objective": "形成有证据的第一人称表达",
                "studentAction": "按五段结构写80—150字脚本",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "包含身份、生活、关系、影响和期待；至少3个证据编号",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:voice-record-narration",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "script",
                          "label": "动物自述脚本",
                          "type": "long_text",
                          "required": true,
                          "minLength": 80,
                          "maxLength": 150,
                          "placeholder": "用自己的话写，事实后标证据编号。"
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "voice-record-narration",
                "title": "录制真人旁白",
                "objective": "留下学生自己的科学表达",
                "studentAction": "朗读经核验的脚本，录制30—60秒旁白",
                "completionMode": "tool_result",
                "evidenceRequirement": "录音30—60秒、中文转写开启、内容与脚本一致",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(录音)",
                "next": "role-stage:voice-peer-verify",
                "tools": [
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 30,
                      "maxSeconds": 60,
                      "language": "zh-CN",
                      "transcribe": true,
                      "prompt": "用自己的声音朗读经核验的脚本；不要模仿或克隆他人声音。"
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "脚本完整、事实可追溯、录音时长合格",
            "passCondition": "脚本完整、事实可追溯、录音时长合格",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_001/assets/placeholders/task.svg",
            "location": {
              "mode": "point",
              "legacyMode": "point",
              "name": "安静录音区",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "teacher",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 840,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "voice-peer-verify",
            "roleStageId": "voice-peer-verify",
            "name": "同伴事实核验",
            "phase": "Phase 4 角色发声",
            "modules": "",
            "tools": [],
            "requirement": "邀请同伴逐句核验脚本并记录修改",
            "guidanceSteps": [
              "和展签记录员逐句核对，记录保留、修改和待核意见",
              "勾选AI参与环节，并写下自己修改或拒绝的一项建议"
            ],
            "steps": [
              {
                "id": "voice-peer-review",
                "title": "提交同伴核验",
                "objective": "让脚本接受外部检查",
                "studentAction": "和展签记录员逐句核对，记录保留、修改和待核意见",
                "completionMode": "tool_result",
                "evidenceRequirement": "至少3条核验记录，包含事实来源和角色期待检查",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A05(团队核验)",
                "next": "step:voice-log-ai-use",
                "tools": [
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "review",
                      "prompt": "逐句核对事实编号，并单独检查角色期待。",
                      "minimumEntries": 3,
                      "roles": [
                        "声音记录员",
                        "展签记录员"
                      ],
                      "recordTypes": [
                        "保留",
                        "修改",
                        "待核"
                      ],
                      "requiredRecordTypes": [
                        "保留",
                        "修改"
                      ]
                    }
                  }
                ]
              },
              {
                "id": "voice-log-ai-use",
                "title": "记录AI参与",
                "objective": "披露AI在作品中的实际作用",
                "studentAction": "勾选AI参与环节，并写下自己修改或拒绝的一项建议",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "AI环节和人工修改记录完整",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "role:complete",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "ai-use",
                          "label": "AI参与环节",
                          "type": "select",
                          "options": [
                            "未使用",
                            "转写",
                            "结构整理",
                            "字幕或降噪",
                            "多项"
                          ],
                          "required": true
                        },
                        {
                          "id": "human-change",
                          "label": "我修改或拒绝的建议",
                          "type": "long_text",
                          "required": true,
                          "minLength": 10
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "至少1条保留、1条修改或确认无需修改的理由",
            "passCondition": "至少1条保留、1条修改或确认无需修改的理由",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_001/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 480,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_zhizhi_001/assets/placeholders/role-card.svg",
        "badgeImage": "lessons/lesson_zhizhi_001/assets/placeholders/badge.svg"
      },
      {
        "id": "id-designer",
        "order": 5,
        "name": "ID设计员",
        "question": "怎样把不同角色的证据组织成一张清楚、可信的居民证？",
        "selectionDescription": "负责汇总事实、关系、需要与来源，制作并审查居民ID Card。",
        "location": "教育空间",
        "geofence": "国家动物博物馆课程允许动线",
        "type": "核心角色",
        "collectionItem": "档案章",
        "collectionItemImage": "lessons/lesson_zhizhi_001/assets/placeholders/token.svg",
        "tasks": [
          {
            "id": "designer-receive-evidence",
            "roleStageId": "designer-receive-evidence",
            "name": "接收证据",
            "phase": "Phase 5 居民证制作",
            "modules": "",
            "tools": [],
            "requirement": "接收身份、来源、关系和声音四类成果",
            "guidanceSteps": [
              "把四类成果卡放入已到齐或待补区",
              "将身份、家园、生态角色、风险、需要、措施和来源放入ID正反面"
            ],
            "steps": [
              {
                "id": "id-check-evidence",
                "title": "检查证据到齐",
                "objective": "确认ID Card有足够证据基础",
                "studentAction": "把四类成果卡放入已到齐或待补区",
                "completionMode": "tool_result",
                "evidenceRequirement": "四张成果卡全部归位，待补内容保留",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(证据墙)",
                "next": "step:id-select-fields",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "evidence-wall",
                      "items": [
                        {
                          "id": "identity",
                          "label": "身份与特征"
                        },
                        {
                          "id": "sources",
                          "label": "事实与来源"
                        },
                        {
                          "id": "ecology",
                          "label": "生态关系图"
                        },
                        {
                          "id": "voice",
                          "label": "角色脚本与录音"
                        }
                      ],
                      "zones": [
                        {
                          "id": "ready",
                          "label": "已到齐"
                        },
                        {
                          "id": "pending",
                          "label": "待补或待核"
                        }
                      ],
                      "connections": [],
                      "prompt": "按当前实际完成状态归位；缺失不要假装到齐。",
                      "zoneMinimums": {
                        "ready": 3,
                        "pending": 1
                      }
                    }
                  }
                ]
              },
              {
                "id": "id-select-fields",
                "title": "匹配ID字段",
                "objective": "把证据放到正确的成果字段",
                "studentAction": "将身份、家园、生态角色、风险、需要、措施和来源放入ID正反面",
                "completionMode": "tool_result",
                "evidenceRequirement": "七类字段全部放置",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(档案搭建)",
                "next": "role-stage:designer-make-id",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "card-layout",
                      "items": [
                        {
                          "id": "identity",
                          "label": "物种名与学名"
                        },
                        {
                          "id": "home",
                          "label": "家园"
                        },
                        {
                          "id": "role",
                          "label": "生态角色"
                        },
                        {
                          "id": "risk",
                          "label": "主要风险"
                        },
                        {
                          "id": "need",
                          "label": "基本需要"
                        },
                        {
                          "id": "measure",
                          "label": "保障措施"
                        },
                        {
                          "id": "sources",
                          "label": "证据编号"
                        }
                      ],
                      "zones": [
                        {
                          "id": "front",
                          "label": "ID正面"
                        },
                        {
                          "id": "back",
                          "label": "ID背面"
                        }
                      ],
                      "connections": [],
                      "prompt": "正面回答它是谁，背面回答怎样生活、面临什么和需要什么。"
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "四类成果和至少1条待核项进入档案区",
            "passCondition": "四类成果和至少1条待核项进入档案区",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_001/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 360,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "designer-make-id",
            "roleStageId": "designer-make-id",
            "name": "制作居民证",
            "phase": "Phase 5 居民证制作",
            "modules": "",
            "tools": [],
            "requirement": "填写ID Card全部核心字段",
            "guidanceSteps": [
              "根据小组成果填写九个字段",
              "填写来源清单、访问日期和AI使用说明"
            ],
            "steps": [
              {
                "id": "id-fill-card",
                "title": "填写ID Card",
                "objective": "形成可发布的居民证初稿",
                "studentAction": "根据小组成果填写九个字段",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "全部字段完整；事实字段附来源，待核内容有标签",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:id-add-ai-disclosure",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "name",
                          "label": "物种名/学名",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "feature",
                          "label": "代表特征+来源",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "home",
                          "label": "家园+来源",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "ecology-role",
                          "label": "生态角色+来源/待核",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "life",
                          "label": "生活方式+来源",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "risk",
                          "label": "主要风险+来源/待核",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "need",
                          "label": "基本需要",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "expectation",
                          "label": "角色期待",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "measure",
                          "label": "人类保障措施",
                          "type": "long_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "id-add-ai-disclosure",
                "title": "添加来源与AI披露",
                "objective": "让作品来源和制作方法透明",
                "studentAction": "填写来源清单、访问日期和AI使用说明",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少3个来源编号、日期和人工复核人",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "role-stage:designer-preflight-review",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "sources",
                          "label": "来源编号（至少3个）",
                          "type": "long_text",
                          "required": true,
                          "minLength": 15
                        },
                        {
                          "id": "date",
                          "label": "访问日期",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "ai",
                          "label": "AI参与和人工修改",
                          "type": "long_text",
                          "required": true,
                          "minLength": 15
                        },
                        {
                          "id": "reviewer",
                          "label": "事实复核人",
                          "type": "short_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "核心字段完整，事实有编号，期待和措施标签清楚",
            "passCondition": "核心字段完整，事实有编号，期待和措施标签清楚",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_001/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 720,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "designer-preflight-review",
            "roleStageId": "designer-preflight-review",
            "name": "发布前审查",
            "phase": "Phase 5 居民证制作",
            "modules": "",
            "tools": [],
            "requirement": "完成事实、边界、隐私和授权四项检查",
            "guidanceSteps": [
              "分别检查事实、标签、隐私和AI披露，记录一项修改",
              "把ID Card和来源清单交给教师或引导员终审"
            ],
            "steps": [
              {
                "id": "id-four-checks",
                "title": "完成四项自检",
                "objective": "发现发布前仍需处理的问题",
                "studentAction": "分别检查事实、标签、隐私和AI披露，记录一项修改",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "四项检查均有结论，至少记录1项修改或无需修改的理由",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:id-teacher-review",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "facts",
                          "label": "事实与来源检查",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "labels",
                          "label": "推断/期待标签检查",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "privacy",
                          "label": "隐私与授权检查",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "ai",
                          "label": "AI披露检查",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "change",
                          "label": "本轮修改及理由",
                          "type": "long_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "id-teacher-review",
                "title": "教师终审",
                "objective": "确认公开事实和授权范围",
                "studentAction": "把ID Card和来源清单交给教师或引导员终审",
                "completionMode": "teacher_confirm",
                "evidenceRequirement": "教师确认事实、隐私、授权和课程作品标识",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A05(提交审核)",
                "next": "role:complete",
                "tools": [
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "review",
                      "prompt": "提交ID Card、来源清单和发布范围。",
                      "minimumEntries": 3,
                      "roles": [
                        "ID设计员",
                        "教师"
                      ],
                      "recordTypes": [
                        "ID Card",
                        "来源清单",
                        "发布范围"
                      ],
                      "requiredRecordTypes": [
                        "ID Card",
                        "来源清单",
                        "发布范围"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "teacher_confirm",
            "evidenceRequirement": "小组自检完成且教师确认可发布",
            "passCondition": "小组自检完成且教师确认可发布",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_001/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 360,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "teacher"
          }
        ],
        "cardImage": "lessons/lesson_zhizhi_001/assets/placeholders/role-card.svg",
        "badgeImage": "lessons/lesson_zhizhi_001/assets/placeholders/badge.svg"
      },
      {
        "id": "assembly-speaker",
        "order": 6,
        "name": "议事发言人",
        "question": "怎样用证据回应质询，并把认识变成一项能检查的行动？",
        "selectionDescription": "负责组织小组发布、回应证据问题，并带领每个人形成行动承诺。",
        "location": "教育空间",
        "geofence": "国家动物博物馆课程允许动线",
        "type": "核心角色",
        "collectionItem": "议事章",
        "collectionItemImage": "lessons/lesson_zhizhi_001/assets/placeholders/token.svg",
        "tasks": [
          {
            "id": "speaker-prepare-release",
            "roleStageId": "speaker-prepare-release",
            "name": "准备发布",
            "phase": "Phase 6 居民发布会",
            "modules": "",
            "tools": [],
            "requirement": "从ID Card中选出一个核心判断和两条证据",
            "guidanceSteps": [
              "填写“我们的判断—证据1—证据2—仍待核”",
              "请同伴提出一个“证据在哪里”的问题并记录回答"
            ],
            "steps": [
              {
                "id": "speaker-build-claim",
                "title": "形成证据陈述",
                "objective": "让发布围绕一个清楚判断展开",
                "studentAction": "填写“我们的判断—证据1—证据2—仍待核”",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "两条证据来源不同，待核项真实存在",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:speaker-rehearse-question",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "claim",
                          "label": "我们的核心判断",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "evidence-1",
                          "label": "证据1+来源",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "evidence-2",
                          "label": "证据2+来源",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "boundary",
                          "label": "仍待核或适用边界",
                          "type": "short_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "speaker-rehearse-question",
                "title": "练习回应质询",
                "objective": "学会用证据、推断或待核回应问题",
                "studentAction": "请同伴提出一个“证据在哪里”的问题并记录回答",
                "completionMode": "tool_result",
                "evidenceRequirement": "包含问题、回答和使用的证据编号",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A05(质询练习)",
                "next": "role-stage:speaker-present-assembly",
                "tools": [
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "discussion",
                      "prompt": "只提出一个最关键的证据问题；回答可以承认待核。",
                      "minimumEntries": 2,
                      "roles": [
                        "议事发言人",
                        "质询同伴"
                      ],
                      "recordTypes": [
                        "证据问题",
                        "证据回应"
                      ],
                      "requiredRecordTypes": [
                        "证据问题",
                        "证据回应"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "判断、证据和边界完整",
            "passCondition": "判断、证据和边界完整",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_001/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 240,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "speaker-present-assembly",
            "roleStageId": "speaker-present-assembly",
            "name": "完成议事发布",
            "phase": "Phase 6 居民发布会",
            "modules": "",
            "tools": [],
            "requirement": "发布ID Card、自述和证据陈述，回应一次质询",
            "guidanceSteps": [
              "用不超过90秒展示ID Card和核心判断",
              "回答一个现场问题，记录是否需要修改ID Card"
            ],
            "steps": [
              {
                "id": "speaker-present",
                "title": "小组发布",
                "objective": "向真实受众清楚呈现小组成果",
                "studentAction": "用不超过90秒展示ID Card和核心判断",
                "completionMode": "teacher_confirm",
                "evidenceRequirement": "展示课程作品标识、至少两条证据和一项待核边界",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(录音)",
                "next": "step:speaker-answer-live-question",
                "tools": [
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 30,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true,
                      "prompt": "记录小组发布，用自己的话说明判断、证据和边界。"
                    }
                  }
                ]
              },
              {
                "id": "speaker-answer-live-question",
                "title": "回答现场问题",
                "objective": "接受公开检验并保留证据边界",
                "studentAction": "回答一个现场问题，记录是否需要修改ID Card",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "回答引用证据、标明推断或承认待核，并写修改决定",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "role-stage:speaker-action-commitment",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "question",
                          "label": "现场问题",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "answer",
                          "label": "我们的回答与证据",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "revision",
                          "label": "保留/修改/待核及理由",
                          "type": "long_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "teacher_confirm",
            "evidenceRequirement": "教师确认发布与回应完成",
            "passCondition": "教师确认发布与回应完成",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_001/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 240,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "teacher"
          },
          {
            "id": "speaker-action-commitment",
            "roleStageId": "speaker-action-commitment",
            "name": "形成行动承诺",
            "phase": "Phase 6 居民发布会",
            "modules": "",
            "tools": [],
            "requirement": "带领每名组员提交一周内可观察的行动",
            "guidanceSteps": [
              "写下动作、对象、时间和一周后的观察方法",
              "收集全组行动，确认每个人都有一条可识别记录"
            ],
            "steps": [
              {
                "id": "speaker-design-action",
                "title": "设计个人行动",
                "objective": "把保护意愿转化为可检查行动",
                "studentAction": "写下动作、对象、时间和一周后的观察方法",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "四项完整，行动安全且由学生自己能够完成",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:speaker-collect-actions",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "action",
                          "label": "我要做什么",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "target",
                          "label": "面向什么对象或场景",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "time",
                          "label": "何时做",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "check",
                          "label": "一周后怎样检查",
                          "type": "long_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "speaker-collect-actions",
                "title": "汇总行动墙",
                "objective": "形成可在课后复盘的小组行动记录",
                "studentAction": "收集全组行动，确认每个人都有一条可识别记录",
                "completionMode": "tool_result",
                "evidenceRequirement": "至少6条匿名行动记录",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A05(行动墙)",
                "next": "role:complete",
                "tools": [
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "commitment",
                      "prompt": "每人提交一条匿名行动，不比较难度。",
                      "minimumEntries": 6,
                      "roles": [
                        "全体组员"
                      ],
                      "recordTypes": [
                        "个人行动"
                      ],
                      "requiredRecordTypes": [
                        "个人行动"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "小组至少6条行动记录，每条含时间和观察方法",
            "passCondition": "小组至少6条行动记录，每条含时间和观察方法",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_001/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 180,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_zhizhi_001/assets/placeholders/role-card.svg",
        "badgeImage": "lessons/lesson_zhizhi_001/assets/placeholders/badge.svg"
      }
    ],
    "timeBank": {
      "enabled": true,
      "initialBalance": 0,
      "currencyUnit": "分钟",
      "earnRules": {
        "maxTotal": 12,
        "maxPerTask": 2,
        "tasksVisibleAtOnce": 3
      },
      "giftRules": {
        "allowGiftToSelf": false,
        "maxPerAction": 3,
        "minAmount": 1,
        "target": "same_group_only"
      },
      "tasks": [
        {
          "id": "tb-01",
          "type": "quiz",
          "question": "哪一句最适合写进“亲眼观察”一栏？",
          "options": [
            "我看见它的前肢有长爪",
            "它一定很孤独",
            "它希望人类保护森林"
          ],
          "answerType": "",
          "hint": "只选择眼睛或耳朵能够直接确认的内容",
          "reward": 2,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-02",
          "type": "quiz",
          "question": "展签和已开放信息卡都没有提到某个结论时，应该怎样记录？",
          "options": [
            "先标为待核实",
            "凭感觉补完整",
            "写成动物亲口告诉我"
          ],
          "answerType": "",
          "hint": "",
          "reward": 2,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-03",
          "type": "quiz",
          "question": "下面哪一种做法更能保护证据的可追溯性？",
          "options": [
            "事实旁写来源",
            "只记最有趣的结论",
            "把观察和猜测混在一起"
          ],
          "answerType": "",
          "hint": "",
          "reward": 2,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-04",
          "type": "photo_checkpoint",
          "question": "拍下一处能支持动物外形特征判断的展项局部，不拍其他参观者正脸",
          "options": [],
          "answerType": "",
          "hint": "遵守展馆当日拍摄规定；不允许拍摄时请教师改为人工确认",
          "reward": 2,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-05",
          "type": "quiz",
          "question": "写下一条亲眼观察到的事实，并说明你观察的是展品、模型、图片还是展签。",
          "options": [],
          "answerType": "open_ended",
          "hint": "",
          "reward": 2,
          "unlockAfter": "phase2-start",
          "minLength": 20,
          "requiresText": false
        },
        {
          "id": "tb-06",
          "type": "quiz",
          "question": "写出一项你愿意做到的动物友好行动，并说明它可能帮助谁。",
          "options": [],
          "answerType": "open_ended",
          "hint": "",
          "reward": 2,
          "unlockAfter": "phase5-start",
          "minLength": 20,
          "requiresText": false
        }
      ]
    },
    "assets": {
      "cover": "lessons/lesson_zhizhi_001/assets/placeholders/cover.svg",
      "chat": "lessons/lesson_zhizhi_001/assets/placeholders/chat-bg.svg",
      "transition": "lessons/lesson_zhizhi_001/assets/placeholders/phase-transition.svg",
      "certificate": "lessons/lesson_zhizhi_001/assets/placeholders/certificate.svg",
      "navigationMap": "lessons/lesson_zhizhi_001/assets/placeholders/navigation-map.svg",
      "importPlaceholder": "lessons/lesson_zhizhi_001/assets/placeholders/opening.svg",
      "simulationPlaceholder": "lessons/lesson_zhizhi_001/assets/placeholders/simulation.svg"
    }
  },
  "lesson_zhizhi_002": {
    "id": "lesson_zhizhi_002",
    "title": "万兽城议事厅Ⅱ：物种守护调查",
    "subtitle": "像一支保护调查队那样，用多源证据诊断风险、审计措施并提出行动方案",
    "series": "致知",
    "seriesCode": "zhizhi",
    "themeTemplate": "zhizhi",
    "venue": "国家动物博物馆及教育空间",
    "mapCenter": null,
    "duration": "270分钟",
    "grades": "小学高年级—高中",
    "groupRule": "6人一组，共同调查一种物种",
    "level": "深度探究版",
    "levelCode": "inquiry",
    "traversalMode": "sequential",
    "coreQuestion": "一个物种为什么面临风险，现有保护措施解决了什么、还缺什么，我们怎样提出有证据且可执行的守护方案？",
    "phases": [
      {
        "id": "phase-1",
        "number": 1,
        "name": "调查开题",
        "duration": "30min",
        "mode": "情境导入 + 小组开题",
        "location": "教育空间",
        "modules": "A06(沉浸媒体), A01(文字), A05(讨论)",
        "trigger": "教师手动启动",
        "endCondition": "物种、核心问题、证据计划和角色分工明确",
        "flow": [
          "阅读一份信息相互矛盾的“保护简报”。",
          "区分保护身份、受威胁等级、种群趋势与措施成效。",
          "选择物种并提出可调查的核心问题。",
          "制定六线取证计划和来源编号规则。"
        ],
        "tasks": [
          {
            "id": "phase-1-task-1",
            "roleStageId": "",
            "name": "提交调查开题卡",
            "phase": "课程任务",
            "modules": "A01(文字表单)",
            "tools": [
              {
                "id": "text",
                "module": "A01",
                "name": "文字表单",
                "icon": "notebook-pen",
                "output": "fields",
                "config": {
                  "fields": [
                    {
                      "id": "species",
                      "label": "调查物种",
                      "type": "short_text",
                      "required": true,
                      "minLength": 2,
                      "maxLength": 30
                    },
                    {
                      "id": "question",
                      "label": "可调查的核心问题",
                      "type": "long_text",
                      "required": true,
                      "minLength": 20,
                      "maxLength": 180
                    },
                    {
                      "id": "plan",
                      "label": "六条证据线怎样分工",
                      "type": "long_text",
                      "required": true,
                      "minLength": 60,
                      "maxLength": 500
                    },
                    {
                      "id": "source-rule",
                      "label": "来源编号规则",
                      "type": "long_text",
                      "required": true,
                      "minLength": 20,
                      "maxLength": 180
                    }
                  ]
                }
              }
            ],
            "requirement": "记录小组物种、核心问题、六线取证计划和来源编号规则",
            "guidanceSteps": [
              "填写调查物种、核心问题、六线分工和来源编号规则"
            ],
            "steps": [
              {
                "id": "phase-1-task-1-step-1",
                "title": "完成四项开题信息",
                "objective": "建立角色选择后可共同使用的调查起点与来源规则",
                "studentAction": "填写调查物种、核心问题、六线分工和来源编号规则",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "四项信息齐全且能支持后续多源取证",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字表单)",
                "next": "role-stage:complete",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "species",
                          "label": "调查物种",
                          "type": "short_text",
                          "required": true,
                          "minLength": 2,
                          "maxLength": 30
                        },
                        {
                          "id": "question",
                          "label": "可调查的核心问题",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20,
                          "maxLength": 180
                        },
                        {
                          "id": "plan",
                          "label": "六条证据线怎样分工",
                          "type": "long_text",
                          "required": true,
                          "minLength": 60,
                          "maxLength": 500
                        },
                        {
                          "id": "source-rule",
                          "label": "来源编号规则",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20,
                          "maxLength": 180
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "ai_evaluation",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "物种、核心问题、六线分工和来源编号规则各一项",
            "passCondition": "四项开题信息齐全，核心问题可调查，来源编号规则可执行",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 480,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation",
            "scope": "phase",
            "phaseId": "phase-1",
            "executor": "个人"
          }
        ]
      },
      {
        "id": "phase-2",
        "number": 2,
        "name": "展厅多源取证",
        "duration": "90min",
        "mode": "角色分线 + 两次汇合",
        "location": "踏勘确认的展厅点位",
        "modules": "A07(实物识别), A01(拍照/文字), A05(证据墙)",
        "trigger": "开题通过教师确认",
        "endCondition": "每条关键主张至少有现场来源，动态主张有第二来源或待核标记",
        "flow": [
          "获取标本、展签、展陈图表和馆方资料。",
          "用“来源—主张—日期—局限”格式登记证据。",
          "将一致、冲突和缺失信息分别上墙。",
          "教师完成第一次来源与点位抽检。"
        ],
        "tasks": []
      },
      {
        "id": "phase-3",
        "number": 3,
        "name": "风险诊断",
        "duration": "45min",
        "mode": "小组建模",
        "location": "教育空间",
        "modules": "A03(趋势图/威胁链), A05(核验)",
        "trigger": "证据墙达到最低完整度",
        "endCondition": "风险诊断包含趋势、直接威胁、驱动因素和不确定性",
        "flow": [
          "绘制带时间与来源的种群趋势。",
          "搭建“人类活动—环境变化—直接威胁—种群结果”链。",
          "对威胁重要性和证据强度分别评分。",
          "保留至少一个替代解释或未知项。"
        ],
        "tasks": []
      },
      {
        "id": "phase-4",
        "number": 4,
        "name": "保护措施审计",
        "duration": "45min",
        "mode": "审计工作坊",
        "location": "教育空间",
        "modules": "A03(审计矩阵), A04(资源模拟)",
        "trigger": "风险诊断通过小组复核",
        "endCondition": "形成措施—威胁对应表、成效证据和保护缺口清单",
        "flow": [
          "核对每项措施试图改变哪一段威胁链。",
          "区分“已经开展”与“已有成效证据”。",
          "用覆盖度、可执行性、公平性和可监测性审计。",
          "识别保护缺口并模拟有限资源配置。"
        ],
        "tasks": []
      },
      {
        "id": "phase-5",
        "number": 5,
        "name": "方案听证",
        "duration": "40min",
        "mode": "利益相关者听证 + 版本修订",
        "location": "教育空间",
        "modules": "A05(听证), A04(方案答辩)",
        "trigger": "审计和缺口清单完成",
        "endCondition": "方案回应至少三类利益相关者，并完成一次有记录的修订",
        "flow": [
          "公布方案目标、行动、责任主体、资源与指标。",
          "利益相关者代表从影响、成本和公平性提出质询。",
          "调查组用证据回应，不能回答的列入待核。",
          "记录采纳、部分采纳或暂不采纳及理由。"
        ],
        "tasks": []
      },
      {
        "id": "phase-6",
        "number": 6,
        "name": "行动书发布",
        "duration": "20min",
        "mode": "小组发布 + 同伴评议",
        "location": "教育空间",
        "modules": "A01(文档), A05(互评)",
        "trigger": "听证修订完成",
        "endCondition": "行动书通过来源、逻辑、执行和边界四项检查",
        "flow": [
          "发布物种档案、风险诊断、措施审计和保护缺口。",
          "提交含目标、行动、主体、资源、指标和复盘日期的行动书。",
          "披露AI使用位置、人工核验人和未解决问题。",
          "每组接受一次可追溯的证据质询。"
        ],
        "tasks": []
      }
    ],
    "roleSystem": {
      "collectionName": "守护调查员",
      "itemName": "证据",
      "pickerEyebrow": "6种调查分工 · 共写1份行动书",
      "pickerTitle": "选择你的{collectionName}身份",
      "pickerDescription": "每位成员负责一条证据线。教师核对小组6条证据线后，组织进入{unlockTarget}。",
      "collectionItemName": "调查章",
      "collectionPanelName": "小组调查章",
      "unlockTarget": "守护方案听证会",
      "phaseId": "phase-2"
    },
    "learningView": {
      "enabled": true,
      "default": "dialogue",
      "allowStudentSwitch": true
    },
    "roles": [
      {
        "id": "species-profiler",
        "order": 1,
        "name": "物种档案员",
        "question": "我们关于这个物种的基础判断，分别来自哪里、适用于什么范围？",
        "selectionDescription": "建立可追溯物种档案，整理形态、分布、栖息地与种群线索。",
        "location": "教师确认的物种展项与教育空间",
        "geofence": "国家动物博物馆课程允许动线",
        "type": "核心角色",
        "collectionItem": "档案章",
        "collectionItemImage": "lessons/lesson_zhizhi_002/assets/placeholders/token.svg",
        "tasks": [
          {
            "id": "profiler-baseline",
            "roleStageId": "profiler-baseline",
            "name": "建立档案骨架",
            "phase": "Phase 2 展厅多源取证（角色取证准备）",
            "modules": "",
            "tools": [],
            "requirement": "先写已知、未知和需要的来源，不让AI直接填档案",
            "guidanceSteps": [
              "选择身份、形态、分布、栖息地、食性和种群中的至少4项，写出待查问题",
              "把现场展签、馆方资料、权威数据库或研究材料分配给档案字段"
            ],
            "steps": [
              {
                "id": "profiler-frame-questions",
                "title": "提出档案问题",
                "objective": "把笼统的“了解物种”转成可调查字段",
                "studentAction": "选择身份、形态、分布、栖息地、食性和种群中的至少4项，写出待查问题",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少4个问题，每个问题指向一个明确字段",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:profiler-plan-sources",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "questions",
                          "label": "档案问题",
                          "type": "long_text",
                          "required": true,
                          "minLength": 40,
                          "placeholder": "例：资料所说的分布范围对应哪一年？"
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "profiler-plan-sources",
                "title": "规划来源",
                "objective": "为不同字段匹配合适来源",
                "studentAction": "把现场展签、馆方资料、权威数据库或研究材料分配给档案字段",
                "completionMode": "tool_result",
                "evidenceRequirement": "至少4条字段—来源计划，含一条动态信息核验计划",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(来源配对)",
                "next": "role-stage:profiler-field-evidence",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "mapping",
                      "items": [],
                      "zones": [],
                      "connections": [],
                      "prompt": "把每个档案字段连到最合适的来源类型；动态字段增加日期和人工核验。",
                      "minimumItems": 4,
                      "categories": [
                        "现场展签",
                        "馆方资料",
                        "权威名录或数据库",
                        "监测或研究材料"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "至少4个档案字段，分别标记已有证据或待核",
            "passCondition": "至少4个档案字段，分别标记已有证据或待核",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_002/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 720,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "profiler-field-evidence",
            "roleStageId": "profiler-field-evidence",
            "name": "现场建档",
            "phase": "Phase 2 展厅多源取证",
            "modules": "",
            "tools": [],
            "requirement": "用现场观察和展签建立带编号的物种档案",
            "guidanceSteps": [
              "拍摄展品与展签，填写三条事实及其照片编号",
              "选择一条分布或种群信息，记录日期、范围、局限和待核办法"
            ],
            "steps": [
              {
                "id": "profiler-capture-facts",
                "title": "采集现场事实",
                "objective": "保存可回到展项复核的身份、形态和生态线索",
                "studentAction": "拍摄展品与展签，填写三条事实及其照片编号",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少1张照片、3条事实和对应来源编号；不拍他人正脸",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(拍照), A01(文字)",
                "next": "step:profiler-register-limit",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 4,
                      "accept": "image/*",
                      "recognition": "course-evidence",
                      "prompt": "拍摄展品主体和可定位的展签区域，避开他人正脸。"
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "facts",
                          "label": "三条现场事实与来源编号",
                          "type": "long_text",
                          "required": true,
                          "minLength": 50
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "profiler-register-limit",
                "title": "登记范围与局限",
                "objective": "说明档案信息适用的时间、空间和证据范围",
                "studentAction": "选择一条分布或种群信息，记录日期、范围、局限和待核办法",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "日期/版本、空间范围、局限、核验办法四项齐全",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(档案表单)",
                "next": "role-stage:profiler-publish-file",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "claim",
                          "label": "动态主张",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "date",
                          "label": "发布日期或版本",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "scope",
                          "label": "空间范围",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "limit",
                          "label": "局限与待核办法",
                          "type": "long_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "至少3条现场事实和1条动态待核项，均有来源编号",
            "passCondition": "至少3条现场事实和1条动态待核项，均有来源编号",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_002/assets/placeholders/task.svg",
            "location": {
              "mode": "point",
              "legacyMode": "point",
              "name": "教师确认的物种展项",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "teacher",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 1680,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "profiler-publish-file",
            "roleStageId": "profiler-publish-file",
            "name": "发布物种档案",
            "phase": "Phase 6 行动书发布",
            "modules": "",
            "tools": [],
            "requirement": "将档案压缩成行动书可用的事实底稿",
            "guidanceSteps": [
              "按身份、分布、栖息地、食性、种群线索和未知项整理",
              "邀请名录核验员和威胁链分析员各核对一处"
            ],
            "steps": [
              {
                "id": "profiler-compose-file",
                "title": "生成档案条目",
                "objective": "形成清楚、可引用且保留未知的物种档案",
                "studentAction": "按身份、分布、栖息地、食性、种群线索和未知项整理",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少5个字段；关键事实带来源编号；至少1个未知项",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(结构化文档)",
                "next": "step:profiler-peer-check",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 6,
                      "accept": "image/*",
                      "recognition": "course-evidence"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "profile",
                          "label": "物种档案",
                          "type": "long_text",
                          "required": true,
                          "minLength": 180
                        },
                        {
                          "id": "unknown",
                          "label": "仍待核验",
                          "type": "long_text",
                          "required": true,
                          "minLength": 15
                        }
                      ]
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  }
                ]
              },
              {
                "id": "profiler-peer-check",
                "title": "交叉复核",
                "objective": "确认档案与名录、威胁证据没有概念冲突",
                "studentAction": "邀请名录核验员和威胁链分析员各核对一处",
                "completionMode": "tool_result",
                "evidenceRequirement": "两条复核记录，含确认、修订或待核及理由",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A05(团队核验)",
                "next": "role:complete",
                "tools": [
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "review",
                      "prompt": "分别核对保护身份/趋势和威胁背景，写明依据。",
                      "minimumEntries": 2,
                      "roles": [
                        "名录核验员",
                        "威胁链分析员"
                      ],
                      "recordTypes": [
                        "确认",
                        "修订",
                        "待核"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "档案字段、来源表和未知项完整，并通过同伴复核",
            "passCondition": "档案字段、来源表和未知项完整，并通过同伴复核",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_002/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 720,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_zhizhi_002/assets/placeholders/role-card.svg",
        "badgeImage": "lessons/lesson_zhizhi_002/assets/placeholders/badge.svg"
      },
      {
        "id": "status-verifier",
        "order": 2,
        "name": "名录核验员",
        "question": "不同保护标签各自回答什么问题，当前版本与适用范围是什么？",
        "selectionDescription": "核对国内法律保护身份、IUCN评估和种群趋势，维护版本与日期记录。",
        "location": "教育空间与指定资料终端",
        "geofence": "国家动物博物馆课程允许区域",
        "type": "核心角色",
        "collectionItem": "核验章",
        "collectionItemImage": "lessons/lesson_zhizhi_002/assets/placeholders/token.svg",
        "tasks": [
          {
            "id": "verifier-separate-labels",
            "roleStageId": "verifier-separate-labels",
            "name": "拆分保护标签",
            "phase": "Phase 2 展厅多源取证（角色取证准备）",
            "modules": "",
            "tools": [],
            "requirement": "把简报中的保护说法分成法律身份、IUCN等级、趋势和措施成效",
            "guidanceSteps": [
              "把简报主张拖入四类证据槽，并标出不能判断的条目",
              "写两条“知道A仍不能直接知道B”的边界句"
            ],
            "steps": [
              {
                "id": "verifier-sort-claims",
                "title": "分类主张",
                "objective": "识别同一句话中混在一起的不同判断",
                "studentAction": "把简报主张拖入四类证据槽，并标出不能判断的条目",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少4条分类，允许保留“信息不足”",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(证据分类)",
                "next": "step:verifier-write-boundary",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "categorize",
                      "items": [],
                      "zones": [],
                      "connections": [],
                      "prompt": "按主张实际回答的问题分类；信息不足可进入待核。",
                      "minimumItems": 4,
                      "categories": [
                        "国内法律保护身份",
                        "IUCN受威胁等级",
                        "种群趋势",
                        "措施成效",
                        "待核"
                      ]
                    }
                  }
                ]
              },
              {
                "id": "verifier-write-boundary",
                "title": "写出推理边界",
                "objective": "说明四类证据之间不能直接推出什么",
                "studentAction": "写两条“知道A仍不能直接知道B”的边界句",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "两条边界句涉及不同概念",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "role-stage:verifier-check-sources",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "boundaries",
                          "label": "两条推理边界",
                          "type": "long_text",
                          "required": true,
                          "minLength": 40
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "完成至少4条主张分类并指出一处不可互推",
            "passCondition": "完成至少4条主张分类并指出一处不可互推",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_002/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 720,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "verifier-check-sources",
            "roleStageId": "verifier-check-sources",
            "name": "核验版本与范围",
            "phase": "Phase 2 展厅多源取证",
            "modules": "",
            "tools": [],
            "requirement": "分别登记国内保护身份、IUCN条目和趋势材料",
            "guidanceSteps": [
              "填写国内法律/名录条目与IUCN条目，缺失内容写待核",
              "记录趋势判断、时间范围、空间范围、方法线索和局限"
            ],
            "steps": [
              {
                "id": "verifier-register-status",
                "title": "登记国内与IUCN条目",
                "objective": "形成两条互不替代的保护状态记录",
                "studentAction": "填写国内法律/名录条目与IUCN条目，缺失内容写待核",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "两条记录均含来源名称、发布机构、版本/评估年、访问日期",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(核验表单)",
                "next": "step:verifier-trend-record",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "domestic",
                          "label": "国内法律或名录记录",
                          "type": "long_text",
                          "required": true,
                          "minLength": 50
                        },
                        {
                          "id": "iucn",
                          "label": "IUCN评估记录",
                          "type": "long_text",
                          "required": true,
                          "minLength": 50
                        },
                        {
                          "id": "access",
                          "label": "访问日期与人工核验人",
                          "type": "short_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "verifier-trend-record",
                "title": "核验趋势材料",
                "objective": "判断资料是否真的支持趋势",
                "studentAction": "记录趋势判断、时间范围、空间范围、方法线索和局限",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "趋势不是单一数量；若只能找到单点数据则明确写“无法判断趋势”",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(趋势记录)",
                "next": "role-stage:verifier-issue-note",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 6,
                      "accept": "image/*",
                      "recognition": "course-evidence"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "trend",
                          "label": "趋势或无法判断",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "time",
                          "label": "时间范围",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "space",
                          "label": "空间范围",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "limit",
                          "label": "方法线索与局限",
                          "type": "long_text",
                          "required": true
                        }
                      ]
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "三类记录独立成行，含来源、版本/日期、范围、访问日期与核验人",
            "passCondition": "三类记录独立成行，含来源、版本/日期、范围、访问日期与核验人",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_002/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间或指定资料终端",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 1680,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "verifier-issue-note",
            "roleStageId": "verifier-issue-note",
            "name": "出具核验说明",
            "phase": "Phase 6 行动书发布",
            "modules": "",
            "tools": [],
            "requirement": "向行动书提供四维状态表和效力日期说明",
            "guidanceSteps": [
              "分别填写国内身份、IUCN等级、趋势、措施成效及待核项",
              "提交需要教师或专家核验的条目清单，记录核验人、日期和处理结果"
            ],
            "steps": [
              {
                "id": "verifier-compose-matrix",
                "title": "制作四维状态表",
                "objective": "让读者一眼看出四类结论、来源和边界",
                "studentAction": "分别填写国内身份、IUCN等级、趋势、措施成效及待核项",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "四行独立；每行有来源编号、日期/版本和适用范围",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(状态矩阵)",
                "next": "step:verifier-human-signoff",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "matrix",
                      "items": [],
                      "zones": [],
                      "connections": [],
                      "prompt": "四类状态独立成行，填写结论、来源、日期或版本、范围和待核项。",
                      "minimumItems": 4,
                      "categories": [
                        "国内法律身份",
                        "IUCN评估",
                        "种群趋势",
                        "措施成效"
                      ]
                    }
                  }
                ]
              },
              {
                "id": "verifier-human-signoff",
                "title": "完成人工核验签注",
                "objective": "对动态和高风险信息留下人工责任链",
                "studentAction": "提交需要教师或专家核验的条目清单，记录核验人、日期和处理结果",
                "completionMode": "teacher_confirm",
                "evidenceRequirement": "至少核验国内身份与IUCN条目；未完成项保留待核",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字记录)",
                "next": "role:complete",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "items",
                          "label": "待核条目与来源编号",
                          "type": "long_text",
                          "required": true,
                          "minLength": 40
                        },
                        {
                          "id": "reviewer",
                          "label": "核验人及核验日期",
                          "type": "text",
                          "required": true
                        },
                        {
                          "id": "result",
                          "label": "处理结果与仍待核内容",
                          "type": "long_text",
                          "required": true,
                          "minLength": 30
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "四维状态表清楚，动态项有复核提示，冲突项未被隐藏",
            "passCondition": "四维状态表清楚，动态项有复核提示，冲突项未被隐藏",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_002/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 720,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_zhizhi_002/assets/placeholders/role-card.svg",
        "badgeImage": "lessons/lesson_zhizhi_002/assets/placeholders/badge.svg"
      },
      {
        "id": "threat-analyst",
        "order": 3,
        "name": "威胁链分析员",
        "question": "哪些因素怎样相连并影响物种，证据能支持到哪一步？",
        "selectionDescription": "收集威胁证据，搭建因果链并区分影响重要性与证据强度。",
        "location": "物种展项、相关生态展项与教育空间",
        "geofence": "国家动物博物馆课程允许动线",
        "type": "核心角色",
        "collectionItem": "诊断章",
        "collectionItemImage": "lessons/lesson_zhizhi_002/assets/placeholders/token.svg",
        "tasks": [
          {
            "id": "threat-frame-hypotheses",
            "roleStageId": "threat-frame-hypotheses",
            "name": "提出风险假设",
            "phase": "Phase 2 展厅多源取证（角色取证准备）",
            "modules": "",
            "tools": [],
            "requirement": "把先入印象改写为可被证据支持或推翻的风险假设",
            "guidanceSteps": [
              "用“如果……通过……可能导致……”写两条假设",
              "为每条假设写一个支持证据和一个可能反证"
            ],
            "steps": [
              {
                "id": "threat-write-hypotheses",
                "title": "写风险假设",
                "objective": "形成可调查的关系判断",
                "studentAction": "用“如果……通过……可能导致……”写两条假设",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "每条包含起因、中间变化和物种结果",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字)",
                "next": "step:threat-plan-tests",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "hypotheses",
                          "label": "两条风险假设",
                          "type": "long_text",
                          "required": true,
                          "minLength": 60
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "threat-plan-tests",
                "title": "设计证伪办法",
                "objective": "主动寻找能支持和削弱假设的证据",
                "studentAction": "为每条假设写一个支持证据和一个可能反证",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "两条假设均有支持与反证计划",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(调查表)",
                "next": "role-stage:threat-build-chain",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 6,
                      "accept": "image/*",
                      "recognition": "course-evidence"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "support",
                          "label": "要找的支持证据",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "counter",
                          "label": "可能削弱假设的证据",
                          "type": "long_text",
                          "required": true
                        }
                      ]
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "至少2条假设，各有需要寻找的证据与可能反证",
            "passCondition": "至少2条假设，各有需要寻找的证据与可能反证",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_002/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 720,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "threat-build-chain",
            "roleStageId": "threat-build-chain",
            "name": "搭建威胁链",
            "phase": "Phase 3 风险诊断",
            "modules": "",
            "tools": [],
            "requirement": "将现场和资料证据放入四层因果链",
            "guidanceSteps": [
              "搭建四层威胁链，为每条箭头绑定证据或推断标签",
              "分别评估潜在影响与证据强度，补充替代解释"
            ],
            "steps": [
              {
                "id": "threat-connect-nodes",
                "title": "连接风险节点",
                "objective": "说明威胁如何从活动传导到种群结果",
                "studentAction": "搭建四层威胁链，为每条箭头绑定证据或推断标签",
                "completionMode": "tool_result",
                "evidenceRequirement": "至少4节点、3连接；每条连接有证据编号或“推断”",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(因果链)",
                "next": "step:threat-score-uncertainty",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "causal_chain",
                      "items": [],
                      "zones": [],
                      "connections": [],
                      "prompt": "按人类活动—环境变化—直接威胁—种群结果连接，每条箭头附证据编号或推断标签。",
                      "minimumItems": 4,
                      "categories": [
                        "人类活动",
                        "环境或栖息地变化",
                        "直接威胁",
                        "种群结果"
                      ]
                    }
                  }
                ]
              },
              {
                "id": "threat-score-uncertainty",
                "title": "双轴评分",
                "objective": "把影响大小和证据把握分开",
                "studentAction": "分别评估潜在影响与证据强度，补充替代解释",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少3个威胁有双轴评分、理由和1个替代解释",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A04(风险矩阵)",
                "next": "role-stage:threat-deliver-diagnosis",
                "tools": [
                  {
                    "id": "simulation",
                    "module": "A04",
                    "name": "沙盘推演",
                    "icon": "waves",
                    "output": "rounds",
                    "config": {
                      "rounds": 1,
                      "resources": {},
                      "choices": [],
                      "metrics": [],
                      "mode": "matrix",
                      "prompt": "分别给潜在影响与证据强度1—4分，并写评分依据。",
                      "axes": [
                        "潜在影响",
                        "证据强度"
                      ],
                      "minimumItems": 3
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "至少4个节点、3条有方向连接、来源编号和1个替代解释",
            "passCondition": "至少4个节点、3条有方向连接、来源编号和1个替代解释",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_002/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 1500,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "threat-deliver-diagnosis",
            "roleStageId": "threat-deliver-diagnosis",
            "name": "交付风险诊断",
            "phase": "Phase 5 方案听证",
            "modules": "",
            "tools": [],
            "requirement": "用一页诊断支持方案答辩，并公开不确定性",
            "guidanceSteps": [
              "选择两条关键链，说明证据、评分和不确定性",
              "邀请一名同伴提出反例，记录维持、修改或待核及理由"
            ],
            "steps": [
              {
                "id": "threat-compose-diagnosis",
                "title": "写诊断摘要",
                "objective": "把模型转成可质询的诊断主张",
                "studentAction": "选择两条关键链，说明证据、评分和不确定性",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "两条诊断均含链条、来源编号、双轴评分和局限",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(诊断摘要)",
                "next": "step:threat-answer-challenge",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 6,
                      "accept": "image/*",
                      "recognition": "course-evidence"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "diagnosis",
                          "label": "风险诊断摘要",
                          "type": "long_text",
                          "required": true,
                          "minLength": 160
                        }
                      ]
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  }
                ]
              },
              {
                "id": "threat-answer-challenge",
                "title": "回应反方质询",
                "objective": "测试诊断能否面对替代解释",
                "studentAction": "邀请一名同伴提出反例，记录维持、修改或待核及理由",
                "completionMode": "tool_result",
                "evidenceRequirement": "一条反例、一项处理结果和理由",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A05(质询)",
                "next": "role:complete",
                "tools": [
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "challenge",
                      "prompt": "请质疑一条因果连接或评分；分析员记录处理结果与证据。",
                      "minimumEntries": 2,
                      "roles": [],
                      "recordTypes": [
                        "反例或质疑",
                        "处理结果与理由"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "核心链、优先风险、证据强度和未知项完整",
            "passCondition": "核心链、优先风险、证据强度和未知项完整",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_002/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 720,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_zhizhi_002/assets/placeholders/role-card.svg",
        "badgeImage": "lessons/lesson_zhizhi_002/assets/placeholders/badge.svg"
      },
      {
        "id": "measure-auditor",
        "order": 4,
        "name": "保护措施审计员",
        "question": "一项保护措施针对什么风险，做了什么，怎样知道它产生了成效？",
        "selectionDescription": "追踪措施逻辑、成效证据与保护缺口，防止“做过”被写成“有效”。",
        "location": "相关展项与教育空间",
        "geofence": "国家动物博物馆课程允许动线",
        "type": "核心角色",
        "collectionItem": "审计章",
        "collectionItemImage": "lessons/lesson_zhizhi_002/assets/placeholders/token.svg",
        "tasks": [
          {
            "id": "auditor-frame-questions",
            "roleStageId": "auditor-frame-questions",
            "name": "定义审计问题",
            "phase": "Phase 2 展厅多源取证（角色取证准备）",
            "modules": "",
            "tools": [],
            "requirement": "为措施建立“目标—活动—结果—证据”问题框架",
            "guidanceSteps": [
              "将简报中的措施描述放入逻辑链位置",
              "为两项措施填写目标、对应威胁、基线、指标和资料计划"
            ],
            "steps": [
              {
                "id": "auditor-separate-claims",
                "title": "拆解措施说法",
                "objective": "区分投入、活动、产出、结果和长期目标",
                "studentAction": "将简报中的措施描述放入逻辑链位置",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少5条描述完成分类，含一条待核",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(逻辑链分类)",
                "next": "step:auditor-plan-evidence",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "categorize",
                      "items": [],
                      "zones": [],
                      "connections": [],
                      "prompt": "判断材料说的是投入、活动、直接产出、短期结果还是长期目标。",
                      "minimumItems": 5,
                      "categories": [
                        "投入",
                        "活动",
                        "直接产出",
                        "短期结果",
                        "长期目标",
                        "待核"
                      ]
                    }
                  }
                ]
              },
              {
                "id": "auditor-plan-evidence",
                "title": "制定审计清单",
                "objective": "明确判断措施成效还缺什么材料",
                "studentAction": "为两项措施填写目标、对应威胁、基线、指标和资料计划",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "两项措施各含5个字段，缺失可标待核",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(审计表)",
                "next": "role-stage:auditor-audit-measures",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 6,
                      "accept": "image/*",
                      "recognition": "course-evidence"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "audit-plan",
                          "label": "两项措施审计清单",
                          "type": "long_text",
                          "required": true,
                          "minLength": 100
                        }
                      ]
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "至少为两类候选措施提出完整审计问题",
            "passCondition": "至少为两类候选措施提出完整审计问题",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_002/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 720,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "auditor-audit-measures",
            "roleStageId": "auditor-audit-measures",
            "name": "审计措施与缺口",
            "phase": "Phase 4 保护措施审计",
            "modules": "",
            "tools": [],
            "requirement": "建立措施—威胁矩阵，评估覆盖、成效证据和缺口",
            "guidanceSteps": [
              "把措施连到威胁链节点，填写责任主体和证据状态",
              "写两条“缺少什么—影响哪段链—证据是什么”"
            ],
            "steps": [
              {
                "id": "auditor-map-measures",
                "title": "连接措施与威胁",
                "objective": "确认每项措施试图改变哪一段风险链",
                "studentAction": "把措施连到威胁链节点，填写责任主体和证据状态",
                "completionMode": "tool_result",
                "evidenceRequirement": "至少3项措施；每项有目标节点、责任主体和来源编号",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(审计矩阵)",
                "next": "step:auditor-find-gaps",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "matrix",
                      "items": [],
                      "zones": [],
                      "connections": [],
                      "prompt": "每项措施连接一个威胁节点，并记录责任主体、活动证据和成效证据。",
                      "minimumItems": 3,
                      "categories": [
                        "措施",
                        "对应威胁",
                        "责任主体",
                        "活动证据",
                        "成效证据"
                      ]
                    }
                  }
                ]
              },
              {
                "id": "auditor-find-gaps",
                "title": "识别保护缺口",
                "objective": "从威胁覆盖、执行和监测中找出具体缺口",
                "studentAction": "写两条“缺少什么—影响哪段链—证据是什么”",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少2条缺口，均引用审计矩阵或威胁链",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(缺口清单)",
                "next": "role-stage:auditor-report-findings",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 6,
                      "accept": "image/*",
                      "recognition": "course-evidence"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "gaps",
                          "label": "保护缺口清单",
                          "type": "long_text",
                          "required": true,
                          "minLength": 80
                        }
                      ]
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "至少3项措施完成审计，产生2条有依据的保护缺口",
            "passCondition": "至少3项措施完成审计，产生2条有依据的保护缺口",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_002/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 1500,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "auditor-report-findings",
            "roleStageId": "auditor-report-findings",
            "name": "报告审计结果",
            "phase": "Phase 5 方案听证",
            "modules": "",
            "tools": [],
            "requirement": "向听证会报告措施覆盖、证据强弱和优先缺口",
            "guidanceSteps": [
              "填写保留、改进、缺口和所需指标四栏",
              "逐项核对行动对应的威胁、缺口和指标，提交修改意见"
            ],
            "steps": [
              {
                "id": "auditor-compose-summary",
                "title": "形成审计摘要",
                "objective": "用审计依据支持方案保留、修改或新增行动",
                "studentAction": "填写保留、改进、缺口和所需指标四栏",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "每栏至少1项并引用来源或矩阵编号",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(审计摘要)",
                "next": "step:auditor-review-action",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "board",
                      "items": [],
                      "zones": [],
                      "connections": [],
                      "prompt": "按保留、改进、保护缺口、所需指标整理，每条绑定证据。",
                      "minimumItems": 4,
                      "categories": [
                        "建议保留",
                        "需要改进",
                        "保护缺口",
                        "所需指标"
                      ]
                    }
                  }
                ]
              },
              {
                "id": "auditor-review-action",
                "title": "复核行动书对应关系",
                "objective": "确保新方案回应诊断与缺口",
                "studentAction": "逐项核对行动对应的威胁、缺口和指标，提交修改意见",
                "completionMode": "tool_result",
                "evidenceRequirement": "至少3项行动完成核对，含1条修改意见",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A05(团队核验)",
                "next": "role:complete",
                "tools": [
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "review",
                      "prompt": "逐项核对行动—威胁—缺口—指标，记录通过或修改理由。",
                      "minimumEntries": 3,
                      "roles": [],
                      "recordTypes": [
                        "通过",
                        "修改",
                        "待核"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "报告至少包含1项可保留措施、1项待改进措施和2项缺口",
            "passCondition": "报告至少包含1项可保留措施、1项待改进措施和2项缺口",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_002/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 720,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_zhizhi_002/assets/placeholders/role-card.svg",
        "badgeImage": "lessons/lesson_zhizhi_002/assets/placeholders/badge.svg"
      },
      {
        "id": "stakeholder-observer",
        "order": 5,
        "name": "利益相关者观察员",
        "question": "谁会影响保护、受到措施影响，谁的知识和声音还没有进入方案？",
        "selectionDescription": "绘制利益相关者图，记录影响、资源、成本、缺席声音和公平性问题。",
        "location": "教育空间与教师批准的观察点",
        "geofence": "国家动物博物馆课程允许区域",
        "type": "核心角色",
        "collectionItem": "协商章",
        "collectionItemImage": "lessons/lesson_zhizhi_002/assets/placeholders/token.svg",
        "tasks": [
          {
            "id": "stakeholder-frame-map",
            "roleStageId": "stakeholder-frame-map",
            "name": "建立相关者假设图",
            "phase": "Phase 2 展厅多源取证（角色取证准备）",
            "modules": "",
            "tools": [],
            "requirement": "从威胁和措施出发识别相关者，不替任何群体编造态度",
            "guidanceSteps": [
              "列出至少5类相关者，说明与物种或措施的关系",
              "为三类相关者分别写影响、资源、成本或参与问题"
            ],
            "steps": [
              {
                "id": "stakeholder-list-groups",
                "title": "识别相关者",
                "objective": "覆盖决策者、执行者、受影响者和知识提供者",
                "studentAction": "列出至少5类相关者，说明与物种或措施的关系",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少5类，每类有关系说明",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(利益相关者图)",
                "next": "step:stakeholder-write-questions",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "stakeholder_map",
                      "items": [],
                      "zones": [],
                      "connections": [],
                      "prompt": "按决策、执行、受影响、知识与监督识别相关者，可一类多职能。",
                      "minimumItems": 5,
                      "categories": [
                        "决策",
                        "执行",
                        "受影响",
                        "知识",
                        "监督"
                      ]
                    }
                  }
                ]
              },
              {
                "id": "stakeholder-write-questions",
                "title": "标记待核假设",
                "objective": "把对群体态度的猜测改成调查问题",
                "studentAction": "为三类相关者分别写影响、资源、成本或参与问题",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少3个开放问题，不预设立场",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(问题表)",
                "next": "role-stage:stakeholder-evidence-map",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 6,
                      "accept": "image/*",
                      "recognition": "course-evidence"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "questions",
                          "label": "相关者开放问题",
                          "type": "long_text",
                          "required": true,
                          "minLength": 60
                        }
                      ]
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "至少5类相关者及需要核验的问题",
            "passCondition": "至少5类相关者及需要核验的问题",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_002/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 720,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "stakeholder-evidence-map",
            "roleStageId": "stakeholder-evidence-map",
            "name": "绘制影响与公平图",
            "phase": "Phase 4 保护措施审计",
            "modules": "",
            "tools": [],
            "requirement": "用已有材料或经同意的匿名记录更新相关者图",
            "guidanceSteps": [
              "为4类相关者填写已知证据、合理推断和仍需询问",
              "选择两项措施，记录谁受益、谁承担成本、谁缺席和补救选项"
            ],
            "steps": [
              {
                "id": "stakeholder-register-evidence",
                "title": "登记证据与未知",
                "objective": "区分材料中真的出现的观点和小组推测",
                "studentAction": "为4类相关者填写已知证据、合理推断和仍需询问",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "每类至少一项，推断与事实有清楚标签",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(多源证据墙)",
                "next": "step:stakeholder-fairness-check",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "evidence_board",
                      "items": [],
                      "zones": [],
                      "connections": [],
                      "prompt": "按相关者记录事实证据、推断和待询问；不得代替群体发言。",
                      "minimumItems": 4,
                      "categories": [
                        "资料事实",
                        "合理推断",
                        "待询问"
                      ]
                    }
                  }
                ]
              },
              {
                "id": "stakeholder-fairness-check",
                "title": "检查公平性",
                "objective": "看见措施收益、成本与参与机会的分布",
                "studentAction": "选择两项措施，记录谁受益、谁承担成本、谁缺席和补救选项",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "两项措施完成四问，至少提出一项补救或替代",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(公平性检查表)",
                "next": "role-stage:stakeholder-hearing",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 6,
                      "accept": "image/*",
                      "recognition": "course-evidence"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "fairness",
                          "label": "两项措施公平性检查",
                          "type": "long_text",
                          "required": true,
                          "minLength": 100
                        }
                      ]
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "至少4类相关者完成影响、资源、成本、参与方式记录",
            "passCondition": "至少4类相关者完成影响、资源、成本、参与方式记录",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_002/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 1320,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "stakeholder-hearing",
            "roleStageId": "stakeholder-hearing",
            "name": "主持相关者质询",
            "phase": "Phase 5 方案听证",
            "modules": "",
            "tools": [],
            "requirement": "帮助不同立场基于影响和证据提问，完整记录回应与修订",
            "guidanceSteps": [
              "组织三类相关者各提出一个具体问题",
              "记录采纳、部分采纳、暂不采纳或待核及理由"
            ],
            "steps": [
              {
                "id": "stakeholder-run-questions",
                "title": "组织三方质询",
                "objective": "让方案接受执行、成本和公平性检查",
                "studentAction": "组织三类相关者各提出一个具体问题",
                "completionMode": "tool_result",
                "evidenceRequirement": "至少3条问题，分别触及影响、成本或参与",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A05(听证)",
                "next": "step:stakeholder-log-decisions",
                "tools": [
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "hearing",
                      "prompt": "问题须指向具体行动和相关者影响，避免扮演刻板立场。",
                      "minimumEntries": 3,
                      "roles": [],
                      "recordTypes": [
                        "影响质询",
                        "成本质询",
                        "参与或公平质询"
                      ],
                      "requiredRecordTypes": [
                        "影响质询",
                        "成本质询",
                        "参与或公平质询"
                      ]
                    }
                  }
                ]
              },
              {
                "id": "stakeholder-log-decisions",
                "title": "登记意见处置",
                "objective": "把听证意见转成可追踪的方案修订",
                "studentAction": "记录采纳、部分采纳、暂不采纳或待核及理由",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少3条意见均有处置、理由和影响的版本位置",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(听证记录)",
                "next": "role:complete",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 6,
                      "accept": "image/*",
                      "recognition": "course-evidence"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "hearing-log",
                          "label": "听证意见处置表",
                          "type": "long_text",
                          "required": true,
                          "minLength": 120
                        }
                      ]
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "至少3类相关者发言，产生3条处置记录",
            "passCondition": "至少3类相关者发言，产生3条处置记录",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_002/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_zhizhi_002/assets/placeholders/role-card.svg",
        "badgeImage": "lessons/lesson_zhizhi_002/assets/placeholders/badge.svg"
      },
      {
        "id": "action-designer",
        "order": 6,
        "name": "行动方案设计员",
        "question": "在证据、资源和相关者约束下，怎样形成能执行、监测和修订的守护行动？",
        "selectionDescription": "整合六线证据，主持资源分配，完成行动书三轮修订与发布。",
        "location": "教育空间",
        "geofence": "国家动物博物馆课程允许区域",
        "type": "核心角色",
        "collectionItem": "行动章",
        "collectionItemImage": "lessons/lesson_zhizhi_002/assets/placeholders/token.svg",
        "tasks": [
          {
            "id": "designer-define-success",
            "roleStageId": "designer-define-success",
            "name": "定义方案成功",
            "phase": "Phase 2 展厅多源取证（角色取证准备）",
            "modules": "",
            "tools": [],
            "requirement": "先定义可观察的成功，再等待证据决定行动",
            "guidanceSteps": [
              "填写目标对象、希望变化、期限和判断成功的方法",
              "为目标列出风险、措施、相关者和资源四类所需证据"
            ],
            "steps": [
              {
                "id": "designer-draft-goal",
                "title": "写目标草案",
                "objective": "把“保护它”改成有对象、变化和期限的目标",
                "studentAction": "填写目标对象、希望变化、期限和判断成功的方法",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "目标包含对象、变化、期限和指标方向",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(目标表单)",
                "next": "step:designer-list-evidence-needs",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "target",
                          "label": "目标对象",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "change",
                          "label": "希望出现的变化",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "time",
                          "label": "期限",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "measure",
                          "label": "怎样判断",
                          "type": "long_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "designer-list-evidence-needs",
                "title": "登记证据需求",
                "objective": "让方案设计等待调查证据",
                "studentAction": "为目标列出风险、措施、相关者和资源四类所需证据",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "四类各至少1项，并指定负责角色",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(证据需求板)",
                "next": "role-stage:designer-allocate-resources",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "board",
                      "items": [],
                      "zones": [],
                      "connections": [],
                      "prompt": "列出目标成立前需要的四类证据，并分配给角色。",
                      "minimumItems": 4,
                      "categories": [
                        "风险证据",
                        "措施证据",
                        "相关者证据",
                        "资源证据"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "形成一个目标草案、两个可监测指标和证据需求",
            "passCondition": "形成一个目标草案、两个可监测指标和证据需求",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_002/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 720,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "designer-allocate-resources",
            "roleStageId": "designer-allocate-resources",
            "name": "模拟资源配置",
            "phase": "Phase 4 保护措施审计",
            "modules": "",
            "tools": [],
            "requirement": "在有限筹码下选择行动并公开取舍",
            "guidanceSteps": [
              "将100点资源分给候选行动，说明优先目标和暂缓项目",
              "抽取一张约束卡，重新配置并记录变化理由"
            ],
            "steps": [
              {
                "id": "designer-first-allocation",
                "title": "配置首轮资源",
                "objective": "依据风险和缺口分配有限资源",
                "studentAction": "将100点资源分给候选行动，说明优先目标和暂缓项目",
                "completionMode": "tool_result",
                "evidenceRequirement": "总计100点；至少3项行动；每项引用风险或缺口",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A04(资源模拟)",
                "next": "step:designer-shock-revision",
                "tools": [
                  {
                    "id": "simulation",
                    "module": "A04",
                    "name": "沙盘推演",
                    "icon": "waves",
                    "output": "rounds",
                    "config": {
                      "rounds": 1,
                      "resources": {},
                      "choices": [],
                      "metrics": [],
                      "mode": "budget",
                      "prompt": "在100点预算内配置至少3项行动，每项绑定风险链或保护缺口。",
                      "budget": 100,
                      "minimumItems": 3
                    }
                  }
                ]
              },
              {
                "id": "designer-shock-revision",
                "title": "应对约束变化",
                "objective": "检验方案在资源减少或新证据出现时能否调整",
                "studentAction": "抽取一张约束卡，重新配置并记录变化理由",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "新旧配置差异、调整依据、被延后行动和触发恢复条件",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A04(情境推演), A01(文字)",
                "next": "role-stage:designer-publish-plan",
                "tools": [
                  {
                    "id": "simulation",
                    "module": "A04",
                    "name": "沙盘推演",
                    "icon": "waves",
                    "output": "rounds",
                    "config": {
                      "rounds": 1,
                      "resources": {},
                      "choices": [],
                      "metrics": [],
                      "mode": "scenario",
                      "prompt": "从预算减少、关键证据降级、相关者成本上升中抽取一项约束。",
                      "scenarios": [
                        "预算减少30%",
                        "一条关键证据降为待核",
                        "一类相关者成本显著上升"
                      ]
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "revision",
                          "label": "调整与理由",
                          "type": "long_text",
                          "required": true,
                          "minLength": 80
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "完成一轮配置、一轮冲击调整和取舍说明",
            "passCondition": "完成一轮配置、一轮冲击调整和取舍说明",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_002/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 1500,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "designer-publish-plan",
            "roleStageId": "designer-publish-plan",
            "name": "发布守护行动书",
            "phase": "Phase 6 行动书发布",
            "modules": "",
            "tools": [],
            "requirement": "整合调查、听证和资源模拟，形成可复盘的课程建议",
            "guidanceSteps": [
              "填写七要素，并标注证据编号、未知项和复盘日期",
              "逐条处理听证意见，生成终稿并声明“课程建议稿”"
            ],
            "steps": [
              {
                "id": "designer-compose-action-book",
                "title": "完成行动书二稿",
                "objective": "让每项行动连接风险、缺口、主体、资源和指标",
                "studentAction": "填写七要素，并标注证据编号、未知项和复盘日期",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "目标、行动、主体、资源、时间、指标、复盘完整；至少6个证据编号",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(结构化文档)",
                "next": "step:designer-final-revision",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 6,
                      "accept": "image/*",
                      "recognition": "course-evidence"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "action-book",
                          "label": "物种守护行动书二稿",
                          "type": "long_text",
                          "required": true,
                          "minLength": 350
                        },
                        {
                          "id": "ai-disclosure",
                          "label": "AI使用与人工核验",
                          "type": "long_text",
                          "required": true,
                          "minLength": 30
                        }
                      ]
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  }
                ]
              },
              {
                "id": "designer-final-revision",
                "title": "完成听证修订并发布",
                "objective": "留下可解释的版本变化和发布边界",
                "studentAction": "逐条处理听证意见，生成终稿并声明“课程建议稿”",
                "completionMode": "teacher_confirm",
                "evidenceRequirement": "至少3条意见处置、版本差异、待核清单和人工终审",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A05(版本对照)",
                "next": "role:complete",
                "tools": [
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "revision",
                      "prompt": "登记意见、采纳状态、修改位置与理由；完成后交由教师核对来源、效力表述、安全边界和AI披露。",
                      "minimumEntries": 3,
                      "roles": []
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "teacher_confirm",
            "evidenceRequirement": "七要素完整，引用六线证据，含版本修订和AI披露",
            "passCondition": "七要素完整，引用六线证据，含版本修订和AI披露",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_002/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 960,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_zhizhi_002/assets/placeholders/role-card.svg",
        "badgeImage": "lessons/lesson_zhizhi_002/assets/placeholders/badge.svg"
      }
    ],
    "timeBank": {
      "enabled": true,
      "initialBalance": 0,
      "currencyUnit": "分钟",
      "earnRules": {
        "maxTotal": 15,
        "maxPerTask": 3,
        "tasksVisibleAtOnce": 3
      },
      "giftRules": {
        "allowGiftToSelf": false,
        "maxPerAction": 5,
        "minAmount": 1,
        "target": "same_group_only"
      },
      "tasks": [
        {
          "id": "tb-01",
          "type": "quiz",
          "question": "国家重点保护身份与IUCN受威胁等级之间是什么关系？",
          "options": [
            "来自不同体系需分别核验",
            "两者永远完全相同",
            "只记录更严重的一项"
          ],
          "answerType": "",
          "hint": "先看发布机构、适用范围和更新时间",
          "reward": 2,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-02",
          "type": "quiz",
          "question": "引用可能变化的保护信息时，哪组记录最完整？",
          "options": [
            "来源加发布日期加访问日期",
            "只写网页标题",
            "只截一张图"
          ],
          "answerType": "",
          "hint": "",
          "reward": 2,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-03",
          "type": "quiz",
          "question": "看到种群数量下降后，哪一步最适合作为下一步？",
          "options": [
            "继续核验时间范围和原因证据",
            "立刻认定唯一威胁",
            "删除不一致资料"
          ],
          "answerType": "",
          "hint": "",
          "reward": 2,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-04",
          "type": "photo_checkpoint",
          "question": "拍下一处含来源、日期或数据单位的公开展项局部，不拍其他参观者正脸",
          "options": [],
          "answerType": "",
          "hint": "遵守展馆当日拍摄规定；无法拍摄时请教师人工确认观察记录",
          "reward": 3,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-05",
          "type": "quiz",
          "question": "用“压力因素—直接影响—种群后果”的顺序写出一条待核验威胁链。",
          "options": [],
          "answerType": "open_ended",
          "hint": "",
          "reward": 3,
          "unlockAfter": "phase3-start",
          "minLength": 30,
          "requiresText": false
        },
        {
          "id": "tb-06",
          "type": "quiz",
          "question": "写出一项现有保护措施、一个成效证据和一个仍需核验的缺口。",
          "options": [],
          "answerType": "open_ended",
          "hint": "",
          "reward": 3,
          "unlockAfter": "phase4-start",
          "minLength": 35,
          "requiresText": false
        }
      ]
    },
    "assets": {
      "cover": "lessons/lesson_zhizhi_002/assets/placeholders/cover.svg",
      "chat": "lessons/lesson_zhizhi_002/assets/placeholders/chat-bg.svg",
      "transition": "lessons/lesson_zhizhi_002/assets/placeholders/phase-transition.svg",
      "certificate": "lessons/lesson_zhizhi_002/assets/placeholders/certificate.svg",
      "navigationMap": "lessons/lesson_zhizhi_002/assets/placeholders/navigation-map.svg",
      "importPlaceholder": "lessons/lesson_zhizhi_002/assets/placeholders/opening.svg",
      "simulationPlaceholder": "lessons/lesson_zhizhi_002/assets/placeholders/simulation.svg"
    }
  },
  "lesson_zhizhi_003": {
    "id": "lesson_zhizhi_003",
    "title": "万兽城议事厅Ⅲ：一条防鸟撞规则的诞生",
    "subtitle": "从科学调查、规范比较和社会协商出发，形成一份可讨论、可复核的青少年规则建议稿",
    "series": "致知",
    "seriesCode": "zhizhi",
    "themeTemplate": "zhizhi",
    "venue": "国家动物博物馆、校园或机构建筑、教育空间",
    "mapCenter": null,
    "duration": "8—12周",
    "grades": "初中—高中",
    "groupRule": "6人一组，围绕同一校园或机构开展研究",
    "level": "研究性学习版",
    "levelCode": "research",
    "traversalMode": "sequential",
    "coreQuestion": "怎样把鸟撞科学、建筑风险、中国规范、域外制度、社会调查和成本效果证据转化为一条程序完整、可执行且可复核的防鸟撞规则建议？",
    "phases": [
      {
        "id": "phase-1",
        "number": 1,
        "name": "问题界定",
        "duration": "第1周",
        "mode": "博物馆导入 + 研究开题",
        "location": "国家动物博物馆或教育空间",
        "modules": "A06(案例媒体), A01(研究问题), A05(开题答辩)",
        "trigger": "教师手动启动",
        "endCondition": "研究对象、概念、范围、伦理与六线计划通过开题",
        "flow": [
          "从鸟类适应、迁徙与城市生境案例提出问题。",
          "区分鸟撞事件、风险代理指标、规范要求和政策建议。",
          "确定一处校园/机构研究范围与替代范围。",
          "完成研究问题、角色分工、伦理与AI使用计划。"
        ],
        "tasks": [
          {
            "id": "phase-1-task-1",
            "roleStageId": "",
            "name": "提交研究开题边界卡",
            "phase": "课程任务",
            "modules": "A01(文字表单)",
            "tools": [
              {
                "id": "text",
                "module": "A01",
                "name": "文字表单",
                "icon": "notebook-pen",
                "output": "fields",
                "config": {
                  "fields": [
                    {
                      "id": "object",
                      "label": "研究对象与主要问题",
                      "type": "long_text",
                      "required": true,
                      "minLength": 40,
                      "maxLength": 300
                    },
                    {
                      "id": "scope",
                      "label": "研究范围与替代范围",
                      "type": "long_text",
                      "required": true,
                      "minLength": 40,
                      "maxLength": 300
                    },
                    {
                      "id": "ethics",
                      "label": "安全、隐私与知情同意边界",
                      "type": "long_text",
                      "required": true,
                      "minLength": 60,
                      "maxLength": 500
                    },
                    {
                      "id": "ai-boundary",
                      "label": "AI可以做什么、不能代替什么",
                      "type": "long_text",
                      "required": true,
                      "minLength": 40,
                      "maxLength": 300
                    }
                  ]
                }
              }
            ],
            "requirement": "记录研究对象、主要问题、研究范围、替代范围、伦理边界与AI使用边界",
            "guidanceSteps": [
              "填写研究对象与问题、主范围与替代范围、伦理边界和AI使用边界"
            ],
            "steps": [
              {
                "id": "phase-1-task-1-step-1",
                "title": "完成研究开题边界卡",
                "objective": "建立角色分线前共同使用的研究范围、伦理与AI边界",
                "studentAction": "填写研究对象与问题、主范围与替代范围、伦理边界和AI使用边界",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "四组信息齐全且能支持后续六条研究线继续细化",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字表单)",
                "next": "role-stage:complete",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "object",
                          "label": "研究对象与主要问题",
                          "type": "long_text",
                          "required": true,
                          "minLength": 40,
                          "maxLength": 300
                        },
                        {
                          "id": "scope",
                          "label": "研究范围与替代范围",
                          "type": "long_text",
                          "required": true,
                          "minLength": 40,
                          "maxLength": 300
                        },
                        {
                          "id": "ethics",
                          "label": "安全、隐私与知情同意边界",
                          "type": "long_text",
                          "required": true,
                          "minLength": 60,
                          "maxLength": 500
                        },
                        {
                          "id": "ai-boundary",
                          "label": "AI可以做什么、不能代替什么",
                          "type": "long_text",
                          "required": true,
                          "minLength": 40,
                          "maxLength": 300
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "ai_evaluation",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "研究对象与问题、主范围与替代范围、伦理边界、AI边界各一项",
            "passCondition": "六项开题信息齐全；问题可研究；范围可替代；安全、隐私和AI边界可执行",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "国家动物博物馆或教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation",
            "scope": "phase",
            "phaseId": "phase-1",
            "executor": "个人"
          }
        ]
      },
      {
        "id": "phase-2",
        "number": 2,
        "name": "科学取证与建筑风险调查",
        "duration": "第2—4周",
        "mode": "文献研究 + 教师批准的重复调查",
        "location": "资料空间与校园/机构建筑外围",
        "modules": "A01(照片/数据), A03(反射标注/风险图), A07(实物识别)",
        "trigger": "开题、路线和安全方案获教师确认",
        "endCondition": "形成可复核调查数据、风险图和科学证据综述",
        "flow": [
          "阅读国内公民科学与主管部门材料，建立变量表。",
          "按固定路线和时段观察玻璃反射、通透、绿植与照明。",
          "对照片去除个人信息，记录零发现和调查限制。",
          "形成高、中、低风险点位图；教师完成安全与数据抽检。"
        ],
        "tasks": []
      },
      {
        "id": "phase-3",
        "number": 3,
        "name": "中国规范与域外比较",
        "duration": "第3—5周",
        "mode": "规范检索 + 三城比较",
        "location": "资料空间",
        "modules": "A03(规范层级图/比较矩阵), A01(原文摘录)",
        "trigger": "研究对象与主要风险变量明确",
        "endCondition": "中国规范地图和多伦多、纽约、旧金山比较报告完成",
        "flow": [
          "核对中国现行法律、已公布待施行法典和深圳实践。",
          "区分法律、地方标准、设计指引、机构规则和倡议。",
          "仅用三城官方原文比较适用范围、措施、程序与执行。",
          "记录版本、效力、适用条件和不可直接移植之处。"
        ],
        "tasks": []
      },
      {
        "id": "phase-4",
        "number": 4,
        "name": "社会调查",
        "duration": "第5—7周",
        "mode": "匿名问卷/访谈 + 主题编码",
        "location": "教师批准的线上或线下空间",
        "modules": "A01(匿名调查), A05(访谈), A03(编码墙)",
        "trigger": "知情同意文本与问题清单获教师批准",
        "endCondition": "形成匿名数据集、编码记录、局限与社会调查报告",
        "flow": [
          "确定需要了解的知识、态度、成本与执行条件。",
          "试访谈后修改诱导、隐私或无法回答的问题。",
          "收集最少必要信息，去标识化并允许退出。",
          "双人编码分歧，公开样本边界和未代表群体。"
        ],
        "tasks": []
      },
      {
        "id": "phase-5",
        "number": 5,
        "name": "起草听证与修订",
        "duration": "第7—10周",
        "mode": "成本效果模拟 + 模拟听证 + 三稿修订",
        "location": "教育空间",
        "modules": "A04(成本效果), A05(听证), A01(条款与版本)",
        "trigger": "四线证据包通过完整性检查",
        "endCondition": "建议稿三稿、听证记录和意见处置表完成",
        "flow": [
          "用规则“五问”形成初稿并逐条绑定证据。",
          "模拟不同预算、建筑条件和例外情境。",
          "由科学、管理、使用者和权益视角公开听证。",
          "对每条意见记录采纳状态、理由和条款变化。"
        ],
        "tasks": []
      },
      {
        "id": "phase-6",
        "number": 6,
        "name": "表决发布与真实转化",
        "duration": "第10—12周",
        "mode": "课程表决 + 研究发布 + 可选真实沟通",
        "location": "教育空间或经批准的发布场所",
        "modules": "A05(表决), A01(发布包)",
        "trigger": "终稿通过科学、规范、伦理和程序审查",
        "endCondition": "课程表决、少数意见、AI披露和后续路径完整",
        "flow": [
          "按条款或整案进行课程内部表决。",
          "发布赞成理由、反对/保留意见和未解问题。",
          "明示“青少年建议稿”，不宣称正式立法或机构采纳。",
          "如获授权，可向校园/机构提交；记录接收状态，不把提交等同采纳。"
        ],
        "tasks": []
      }
    ],
    "roleSystem": {
      "collectionName": "规则研究员",
      "itemName": "证据线",
      "pickerEyebrow": "6种研究分工 · 共创1份建议稿",
      "pickerTitle": "选择你的{collectionName}身份",
      "pickerDescription": "每位成员负责一条研究线。完成3轮研究与复核并经教师确认后，进入{unlockTarget}。",
      "collectionItemName": "研究章",
      "collectionPanelName": "四线证据包",
      "unlockTarget": "规则表决与发布",
      "phaseId": "phase-1"
    },
    "learningView": {
      "enabled": true,
      "default": "dialogue",
      "allowStudentSwitch": true
    },
    "roles": [
      {
        "id": "science-researcher",
        "order": 1,
        "name": "科学证据研究员",
        "question": "现场观察和科学材料能支持怎样的鸟撞风险判断，边界在哪里？",
        "selectionDescription": "研究鸟撞机制，设计重复调查，形成风险图和科学证据综述。",
        "location": "资料空间与教师批准的建筑外围路线",
        "geofence": "教师批准路线、时段和替代点",
        "type": "核心角色",
        "collectionItem": "科学章",
        "collectionItemImage": "lessons/lesson_zhizhi_003/assets/placeholders/token.svg",
        "tasks": [
          {
            "id": "science-design-study",
            "roleStageId": "science-design-study",
            "name": "设计可复现调查",
            "phase": "Phase 1 问题界定",
            "modules": "",
            "tools": [],
            "requirement": "区分事件与风险变量，提交路线、变量和安全计划",
            "guidanceSteps": [
              "提出两条机制假设，列出事件指标、风险变量、控制记录和可能反证",
              "提交路线、点位、时段、成人陪同、替代点、天气与零发现记录方式"
            ],
            "steps": [
              {
                "id": "science-frame-variables",
                "title": "建立机制与变量表",
                "objective": "把“玻璃危险”拆成可观察变量与有限假设",
                "studentAction": "提出两条机制假设，列出事件指标、风险变量、控制记录和可能反证",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少2条假设、4个风险变量、2个控制记录和1个可能反证",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(变量表)",
                "next": "step:science-approve-route",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "research_variables",
                      "items": [],
                      "zones": [],
                      "connections": [],
                      "prompt": "区分事件指标、风险变量、控制记录和可能反证。",
                      "minimumItems": 9,
                      "categories": [
                        "事件指标",
                        "风险变量",
                        "控制记录",
                        "可能反证"
                      ]
                    }
                  }
                ]
              },
              {
                "id": "science-approve-route",
                "title": "送审路线与记录规则",
                "objective": "确保调查可重复且人身安全",
                "studentAction": "提交路线、点位、时段、成人陪同、替代点、天气与零发现记录方式",
                "completionMode": "teacher_confirm",
                "evidenceRequirement": "路线图和安全清单完整；排除屋顶、施工区、车行区和夜间单独调查",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字表单)",
                "next": "role-stage:science-run-survey",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "route",
                          "label": "路线、点位、时段与替代点",
                          "type": "long_text",
                          "required": true,
                          "minLength": 100
                        },
                        {
                          "id": "safety",
                          "label": "陪同、安全和事件报告流程",
                          "type": "long_text",
                          "required": true,
                          "minLength": 60
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "机制假设、变量表、记录规则和安全路线经教师确认",
            "passCondition": "机制假设、变量表、记录规则和安全路线经教师确认",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_003/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 1,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "science-run-survey",
            "roleStageId": "science-run-survey",
            "name": "执行建筑风险调查",
            "phase": "Phase 2 科学取证与建筑风险调查",
            "modules": "",
            "tools": [],
            "requirement": "按相同规则重复观察，形成去标识数据和风险图",
            "guidanceSteps": [
              "按批准路线完成至少3轮，记录日期、时段、天气、点位、风险变量、事件或零发现",
              "在示意图标注反射、通透、绿植、照明、事件/零发现和证据强度"
            ],
            "steps": [
              {
                "id": "science-collect-observations",
                "title": "完成重复记录",
                "objective": "获得可比较的现场数据",
                "studentAction": "按批准路线完成至少3轮，记录日期、时段、天气、点位、风险变量、事件或零发现",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少3轮完整记录与合规照片；路线变化有理由",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(拍照), A01(调查数据)",
                "next": "step:science-map-risk",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 3,
                      "maxCount": 18,
                      "accept": "image/*",
                      "recognition": "course-evidence",
                      "prompt": "拍玻璃与环境关系，避开人脸、门牌、工位和无关室内信息。"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "survey-log",
                          "label": "重复调查记录",
                          "type": "long_text",
                          "required": true,
                          "minLength": 180
                        }
                      ]
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  }
                ]
              },
              {
                "id": "science-map-risk",
                "title": "形成风险图",
                "objective": "把风险变量映射到点位并公开不确定性",
                "studentAction": "在示意图标注反射、通透、绿植、照明、事件/零发现和证据强度",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少5个点位；高、中、低或未知均有理由和照片/记录编号",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(风险图画板)",
                "next": "role-stage:science-deliver-evidence",
                "tools": [
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 960,
                      "height": 640,
                      "brushColors": [
                        "#b91c1c",
                        "#d97706",
                        "#15803d",
                        "#475569"
                      ],
                      "backgroundImage": "lessons/lesson_zhizhi_003/assets/placeholders/navigation-map.svg",
                      "prompt": "在批准路线示意图上标注风险变量、事件/零发现、等级理由和编号。"
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "至少3轮调查、每轮含零发现、照片和环境记录，并通过抽检",
            "passCondition": "至少3轮调查、每轮含零发现、照片和环境记录，并通过抽检",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_003/assets/placeholders/task.svg",
            "location": {
              "mode": "route",
              "legacyMode": "route",
              "name": "教师批准的建筑外围路线",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "teacher",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 2,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "science-deliver-evidence",
            "roleStageId": "science-deliver-evidence",
            "name": "交付科学证据线",
            "phase": "Phase 5 起草听证与修订",
            "modules": "",
            "tools": [],
            "requirement": "将文献与现场数据转成条款可引用的证据摘要",
            "guidanceSteps": [
              "写机制证据、现场发现、零发现、局限和对措施选择的含义",
              "回应一条替代解释或方法质疑，记录维持、修改或待核"
            ],
            "steps": [
              {
                "id": "science-compose-brief",
                "title": "撰写科学证据摘要",
                "objective": "说明能判断什么、不能判断什么",
                "studentAction": "写机制证据、现场发现、零发现、局限和对措施选择的含义",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少6个来源/数据编号；明确事件与风险、相关与因果边界",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(研究摘要)",
                "next": "step:science-defend-evidence",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 6,
                      "accept": "image/*",
                      "recognition": "course-evidence"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "science-brief",
                          "label": "科学证据摘要",
                          "type": "long_text",
                          "required": true,
                          "minLength": 300
                        },
                        {
                          "id": "limits",
                          "label": "局限与不可判断事项",
                          "type": "long_text",
                          "required": true,
                          "minLength": 80
                        }
                      ]
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  }
                ]
              },
              {
                "id": "science-defend-evidence",
                "title": "接受反证质询",
                "objective": "检验条款所依赖的科学假设",
                "studentAction": "回应一条替代解释或方法质疑，记录维持、修改或待核",
                "completionMode": "tool_result",
                "evidenceRequirement": "质疑、回应、处理状态和影响的条款位置齐全",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A05(同行评议)",
                "next": "role:complete",
                "tools": [
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "peer_review",
                      "prompt": "质疑一个变量、推断或推广范围；记录证据化回应。",
                      "minimumEntries": 2,
                      "roles": [],
                      "recordTypes": [
                        "质疑",
                        "回应与处置"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "机制、现场模式、局限和措施证据完整，接受一次反证质询",
            "passCondition": "机制、现场模式、局限和措施证据完整，接受一次反证质询",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_003/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 1,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_zhizhi_003/assets/placeholders/role-card.svg",
        "badgeImage": "lessons/lesson_zhizhi_003/assets/placeholders/badge.svg"
      },
      {
        "id": "china-norm-researcher",
        "order": 2,
        "name": "中国规范研究员",
        "question": "中国现有材料分别处于什么规范层级，何时生效，能支持怎样的本地建议？",
        "selectionDescription": "建立中国规范地图，核对法律效力日期，研究深圳标准与实践。",
        "location": "资料空间",
        "geofence": "课程资料与教师批准检索范围",
        "type": "核心角色",
        "collectionItem": "规范章",
        "collectionItemImage": "lessons/lesson_zhizhi_003/assets/placeholders/token.svg",
        "tasks": [
          {
            "id": "china-frame-norms",
            "roleStageId": "china-frame-norms",
            "name": "建立规范检索框架",
            "phase": "Phase 1 问题界定",
            "modules": "",
            "tools": [],
            "requirement": "先区分层级、效力与研究问题，再开展检索",
            "guidanceSteps": [
              "将候选材料按制定主体、形式和效力初步分类，未知项保留待核",
              "确定名称、机关、文号/版本、公布日、施行日、范围、强制性和访问日字段"
            ],
            "steps": [
              {
                "id": "china-sort-materials",
                "title": "区分材料层级",
                "objective": "避免把倡议、指引、标准和法律混写",
                "studentAction": "将候选材料按制定主体、形式和效力初步分类，未知项保留待核",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少6条材料分类，含2条待核理由",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(规范层级图)",
                "next": "step:china-set-record-fields",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "hierarchy",
                      "items": [],
                      "zones": [],
                      "connections": [],
                      "prompt": "按法律、法规/规章、标准、指引、机构规则、倡议分类；不确定时标待核。",
                      "minimumItems": 6,
                      "categories": [
                        "法律",
                        "法规或规章",
                        "标准",
                        "设计指引",
                        "机构规则",
                        "倡议",
                        "待核"
                      ]
                    }
                  }
                ]
              },
              {
                "id": "china-set-record-fields",
                "title": "制定效力登记表",
                "objective": "让每份规范可追溯且可更新",
                "studentAction": "确定名称、机关、文号/版本、公布日、施行日、范围、强制性和访问日字段",
                "completionMode": "tool_result",
                "evidenceRequirement": "字段齐全并指定人工核验人",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(规范登记表)",
                "next": "role-stage:china-build-map",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 6,
                      "accept": "image/*",
                      "recognition": "course-evidence"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "protocol",
                          "label": "规范登记字段与核验流程",
                          "type": "long_text",
                          "required": true,
                          "minLength": 100
                        },
                        {
                          "id": "reviewer",
                          "label": "人工核验人/岗位",
                          "type": "short_text",
                          "required": true
                        }
                      ]
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "形成规范层级图和五字段来源登记规则",
            "passCondition": "形成规范层级图和五字段来源登记规则",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_003/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 1,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "china-build-map",
            "roleStageId": "china-build-map",
            "name": "核验中国规范与深圳实践",
            "phase": "Phase 3 中国规范与域外比较",
            "modules": "",
            "tools": [],
            "requirement": "核验野生动物保护法、生态环境法典时间状态和深圳地方标准",
            "guidanceSteps": [
              "定位原文，记录公布/修订日、施行日、相关条文、范围和当前状态",
              "用官方材料建立时间线，提取DB4403/T 616—2025的范围、措施和用语"
            ],
            "steps": [
              {
                "id": "china-verify-laws",
                "title": "核对法律时间状态",
                "objective": "准确表达当前法与已公布待施行法典",
                "studentAction": "定位原文，记录公布/修订日、施行日、相关条文、范围和当前状态",
                "completionMode": "teacher_confirm",
                "evidenceRequirement": "野生动物保护法与生态环境法典分别登记；截至调查日的状态清楚",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字记录)",
                "next": "step:china-study-shenzhen",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "wildlife-law",
                          "label": "野生动物保护法原文与效力记录",
                          "type": "long_text",
                          "required": true,
                          "minLength": 100
                        },
                        {
                          "id": "code",
                          "label": "生态环境法典原文与时间状态",
                          "type": "long_text",
                          "required": true,
                          "minLength": 100
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "china-study-shenzhen",
                "title": "重建深圳实践链",
                "objective": "区分调查、研讨、征求意见、标准与实践",
                "studentAction": "用官方材料建立时间线，提取DB4403/T 616—2025的范围、措施和用语",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少5个时间节点；标准含文号、发布日期、实施日、适用范围和3类措施",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(政策时间线), A01(原文摘录)",
                "next": "role-stage:china-deliver-map",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "timeline",
                      "items": [],
                      "zones": [],
                      "connections": [],
                      "prompt": "连接调查、研讨、征求意见、地方标准和实践，分别标效力。",
                      "minimumItems": 5
                    }
                  },
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 6,
                      "accept": "image/*",
                      "recognition": "course-evidence"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "standard-extract",
                          "label": "深圳标准原文摘录与范围",
                          "type": "long_text",
                          "required": true,
                          "minLength": 160
                        }
                      ]
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "三类核心材料原文、效力、范围和人工签注完整",
            "passCondition": "三类核心材料原文、效力、范围和人工签注完整",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_003/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "资料空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 2,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "china-deliver-map",
            "roleStageId": "china-deliver-map",
            "name": "交付规范地图",
            "phase": "Phase 5 起草听证与修订",
            "modules": "",
            "tools": [],
            "requirement": "说明哪些材料提供原则、技术参考或本地程序依据",
            "guidanceSteps": [
              "按层级呈现材料，并为每份写“可支持/不能直接推出/需更新”",
              "抽查至少5条条款，标注现行依据、借鉴依据、课程选择或待核"
            ],
            "steps": [
              {
                "id": "china-compose-norm-map",
                "title": "制作规范地图与边界",
                "objective": "让起草组知道每份材料能支持到哪里",
                "studentAction": "按层级呈现材料，并为每份写“可支持/不能直接推出/需更新”",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少5份材料有三类边界说明和来源编号",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(规范地图)",
                "next": "step:china-review-clauses",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "norm_map",
                      "items": [],
                      "zones": [],
                      "connections": [],
                      "prompt": "每份材料记录层级、效力、范围、可支持、不能直接推出和更新条件。",
                      "minimumItems": 5
                    }
                  }
                ]
              },
              {
                "id": "china-review-clauses",
                "title": "审查条款效力表述",
                "objective": "避免建议稿把参考依据写成强制本地要求",
                "studentAction": "抽查至少5条条款，标注现行依据、借鉴依据、课程选择或待核",
                "completionMode": "teacher_confirm",
                "evidenceRequirement": "5条以上审查记录，法律与标准结论由人工签注",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A05(条款审查)",
                "next": "role:complete",
                "tools": [
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "clause_review",
                      "prompt": "逐条标注现行依据、借鉴依据、课程选择或待核；完成后交由教师确认条款未冒充现行法律义务或正式法律意见。",
                      "minimumEntries": 5,
                      "roles": []
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "规范地图、可引用结论、不可推出事项和更新提示完整",
            "passCondition": "规范地图、可引用结论、不可推出事项和更新提示完整",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_003/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 1,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_zhizhi_003/assets/placeholders/role-card.svg",
        "badgeImage": "lessons/lesson_zhizhi_003/assets/placeholders/badge.svg"
      },
      {
        "id": "comparative-researcher",
        "order": 3,
        "name": "域外制度研究员",
        "question": "多伦多、纽约和旧金山怎样界定问题与规则，哪些经验具备本地借鉴条件？",
        "selectionDescription": "核验三城官方原文，建立七项比较矩阵并评估可借鉴条件。",
        "location": "资料空间",
        "geofence": "指定三城官方来源",
        "type": "核心角色",
        "collectionItem": "比较章",
        "collectionItemImage": "lessons/lesson_zhizhi_003/assets/placeholders/token.svg",
        "tasks": [
          {
            "id": "comparative-set-protocol",
            "roleStageId": "comparative-set-protocol",
            "name": "制定三城原文协议",
            "phase": "Phase 1 问题界定",
            "modules": "",
            "tools": [],
            "requirement": "限定官方来源，定义统一比较字段和翻译核验方式",
            "guidanceSteps": [
              "分别登记多伦多市、纽约市议会和旧金山规划部门官方页面",
              "确认七项比较字段，规定原文摘录、学生译文、关键词保留和双人复核"
            ],
            "steps": [
              {
                "id": "comparative-register-sources",
                "title": "锁定官方来源",
                "objective": "避免使用二手摘要代替制度原文",
                "studentAction": "分别登记多伦多市、纽约市议会和旧金山规划部门官方页面",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "三条来源含机构、标题、URL、访问日期和原文状态",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(来源登记)",
                "next": "step:comparative-define-fields",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 6,
                      "accept": "image/*",
                      "recognition": "course-evidence"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "toronto",
                          "label": "多伦多官方来源",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "new-york",
                          "label": "纽约官方来源",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "san-francisco",
                          "label": "旧金山官方来源",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "access",
                          "label": "访问日期",
                          "type": "short_text",
                          "required": true
                        }
                      ]
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  }
                ]
              },
              {
                "id": "comparative-define-fields",
                "title": "统一比较与翻译规则",
                "objective": "让三城材料在同一问题框架下可比较",
                "studentAction": "确认七项比较字段，规定原文摘录、学生译文、关键词保留和双人复核",
                "completionMode": "tool_result",
                "evidenceRequirement": "七项字段和翻译复核流程齐全",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(比较框架)",
                "next": "role-stage:comparative-build-matrix",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "comparison_schema",
                      "items": [],
                      "zones": [],
                      "connections": [],
                      "prompt": "设置规范层级、适用对象、风险触发、玻璃措施、照明措施、例外替代、审查执行七列。",
                      "minimumItems": 7
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "三城来源、七项字段、版本记录和翻译核验规则完整",
            "passCondition": "三城来源、七项字段、版本记录和翻译核验规则完整",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_003/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 1,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "comparative-build-matrix",
            "roleStageId": "comparative-build-matrix",
            "name": "完成三城比较",
            "phase": "Phase 3 中国规范与域外比较",
            "modules": "",
            "tools": [],
            "requirement": "从官方原文提取范围、措施、例外与程序，记录不可比项",
            "guidanceSteps": [
              "每城至少提取3段短原文，记录页面/条款位置、学生译文和字段",
              "完成七项矩阵，为三项异同写原因假设和不可直接比较之处"
            ],
            "steps": [
              {
                "id": "comparative-extract-text",
                "title": "提取原文证据",
                "objective": "让比较结论回到具体官方文本",
                "studentAction": "每城至少提取3段短原文，记录页面/条款位置、学生译文和字段",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少9条摘录；每条含原文位置、译文、字段和复核人",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(原文摘录卡)",
                "next": "step:comparative-fill-matrix",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 6,
                      "accept": "image/*",
                      "recognition": "course-evidence"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "extracts",
                          "label": "三城原文摘录、位置与译文",
                          "type": "long_text",
                          "required": true,
                          "minLength": 450
                        },
                        {
                          "id": "reviewer",
                          "label": "第二复核人",
                          "type": "short_text",
                          "required": true
                        }
                      ]
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  }
                ]
              },
              {
                "id": "comparative-fill-matrix",
                "title": "解释异同与不可比",
                "objective": "比较制度选择，同时尊重情境差异",
                "studentAction": "完成七项矩阵，为三项异同写原因假设和不可直接比较之处",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "七项×三城有记录或“不适用/未找到”；至少3条异同与2条不可比说明",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(比较法矩阵)",
                "next": "role-stage:comparative-localize",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "comparison_matrix",
                      "items": [],
                      "zones": [],
                      "connections": [],
                      "prompt": "三城按七项同列比较，空白须写未找到、不适用或待核。",
                      "minimumItems": 21
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "三城七项矩阵、原文编号、双人译文复核和不可比说明完整",
            "passCondition": "三城七项矩阵、原文编号、双人译文复核和不可比说明完整",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_003/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "资料空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 2,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "comparative-localize",
            "roleStageId": "comparative-localize",
            "name": "形成可借鉴性报告",
            "phase": "Phase 5 起草听证与修订",
            "modules": "",
            "tools": [],
            "requirement": "筛选可借鉴做法，并说明本地权限、条件、调整与试点需求",
            "guidanceSteps": [
              "为3项候选做法回答问题相似性、主体权限、技术成本条件和试点/例外",
              "提交三城比较、候选做法、不可直接移植项和待核清单"
            ],
            "steps": [
              {
                "id": "comparative-assess-transfer",
                "title": "完成本地化四问",
                "objective": "把“国外这样做”转成条件化建议",
                "studentAction": "为3项候选做法回答问题相似性、主体权限、技术成本条件和试点/例外",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "3项×4问完整，每项引用原文与本地证据编号",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(可借鉴性矩阵)",
                "next": "step:comparative-deliver-report",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "transfer_matrix",
                      "items": [],
                      "zones": [],
                      "connections": [],
                      "prompt": "对3项做法回答本地问题、主体权限、实施条件、试点例外。",
                      "minimumItems": 12
                    }
                  }
                ]
              },
              {
                "id": "comparative-deliver-report",
                "title": "发布比较报告",
                "objective": "向起草组交付可追溯、不过度移植的结论",
                "studentAction": "提交三城比较、候选做法、不可直接移植项和待核清单",
                "completionMode": "tool_result",
                "evidenceRequirement": "至少3项可借鉴建议、1项不建议直接移植、1项待核",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(比较报告), A05(团队复核)",
                "next": "role:complete",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 6,
                      "accept": "image/*",
                      "recognition": "course-evidence"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "report",
                          "label": "三城比较与可借鉴性报告",
                          "type": "long_text",
                          "required": true,
                          "minLength": 350
                        }
                      ]
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  },
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "review",
                      "prompt": "中国规范研究员与影响评估员核对权限和实施条件。",
                      "minimumEntries": 2,
                      "roles": [
                        "中国规范研究员",
                        "影响评估员"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "至少3项候选做法通过四问，含1项不建议直接移植",
            "passCondition": "至少3项候选做法通过四问，含1项不建议直接移植",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_003/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 1,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_zhizhi_003/assets/placeholders/role-card.svg",
        "badgeImage": "lessons/lesson_zhizhi_003/assets/placeholders/badge.svg"
      },
      {
        "id": "social-researcher",
        "order": 4,
        "name": "社会调查员",
        "question": "校园或机构使用者、管理者和相关群体怎样理解问题，会受到什么影响？",
        "selectionDescription": "设计匿名调查，实施知情同意，完成双人编码和样本边界说明。",
        "location": "教师批准的线上或线下调查空间",
        "geofence": "经批准的对象、渠道与时段",
        "type": "核心角色",
        "collectionItem": "社会章",
        "collectionItemImage": "lessons/lesson_zhizhi_003/assets/placeholders/token.svg",
        "tasks": [
          {
            "id": "social-design-study",
            "roleStageId": "social-design-study",
            "name": "完成伦理与工具送审",
            "phase": "Phase 1 问题界定",
            "modules": "",
            "tools": [],
            "requirement": "确定最少数据、知情同意、退出机制和不诱导问题",
            "guidanceSteps": [
              "说明需要听见哪些群体、为何需要、招募方式、最少字段和未代表群体",
              "提交知情同意页和8—12个问题，用2名非样本同伴试测后修改"
            ],
            "steps": [
              {
                "id": "social-plan-sample",
                "title": "定义样本与最少数据",
                "objective": "只收集回答研究问题所必需的信息",
                "studentAction": "说明需要听见哪些群体、为何需要、招募方式、最少字段和未代表群体",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少3类群体；每个数据字段有用途；不收集姓名和无关联系方式",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(样本计划)",
                "next": "step:social-approve-instrument",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 6,
                      "accept": "image/*",
                      "recognition": "course-evidence"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "sample",
                          "label": "样本与招募计划",
                          "type": "long_text",
                          "required": true,
                          "minLength": 120
                        },
                        {
                          "id": "fields",
                          "label": "最少数据字段及用途",
                          "type": "long_text",
                          "required": true,
                          "minLength": 80
                        }
                      ]
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  }
                ]
              },
              {
                "id": "social-approve-instrument",
                "title": "试测并送审",
                "objective": "消除诱导、双重问题和不清楚的同意流程",
                "studentAction": "提交知情同意页和8—12个问题，用2名非样本同伴试测后修改",
                "completionMode": "teacher_confirm",
                "evidenceRequirement": "同意、用途、时长、记录、跳过、退出、联系渠道完整；保留试测修改",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A05(试访谈)",
                "next": "role-stage:social-collect-code",
                "tools": [
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "pilot",
                      "prompt": "标记诱导、双重、含糊、过度隐私或无法回答的问题；完成后交由教师核对同意、最少采集、未成年人要求、退出和公开边界。",
                      "minimumEntries": 2,
                      "roles": []
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "同意页、样本计划和调查工具经教师批准",
            "passCondition": "同意页、样本计划和调查工具经教师批准",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_003/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 1,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "social-collect-code",
            "roleStageId": "social-collect-code",
            "name": "匿名收集与双人编码",
            "phase": "Phase 4 社会调查",
            "modules": "",
            "tools": [],
            "requirement": "按批准工具收集最少数据，去标识后由两人独立编码",
            "guidanceSteps": [
              "先完成同意确认，再收集回答；分别保存同意状态与匿名研究数据",
              "两人独立编码同一小批材料，比较后修订编码本，再完成全体编码"
            ],
            "steps": [
              {
                "id": "social-collect-anonymous",
                "title": "实施匿名调查",
                "objective": "获得合规、可撤回且不超范围的材料",
                "studentAction": "先完成同意确认，再收集回答；分别保存同意状态与匿名研究数据",
                "completionMode": "tool_result",
                "evidenceRequirement": "每条记录有同意状态和匿名编号；无姓名、联系方式或可识别原音频进入公开对象",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(匿名表单), A01(同意记录)",
                "next": "step:social-double-code",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "consent-log",
                          "label": "同意与退出状态汇总（不含身份）",
                          "type": "long_text",
                          "required": true,
                          "minLength": 40
                        },
                        {
                          "id": "anonymous-data",
                          "label": "匿名研究数据",
                          "type": "long_text",
                          "required": true,
                          "minLength": 160
                        }
                      ]
                    }
                  },
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 6,
                      "accept": "image/*",
                      "recognition": "course-evidence"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  }
                ]
              },
              {
                "id": "social-double-code",
                "title": "双人编码与分歧处理",
                "objective": "让主题定义可检查并保留例外",
                "studentAction": "两人独立编码同一小批材料，比较后修订编码本，再完成全体编码",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "初始双人编码、至少2处分歧、修订定义、例外和未代表群体",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(编码墙)",
                "next": "role-stage:social-report-findings",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "qualitative_coding",
                      "items": [],
                      "zones": [],
                      "connections": [],
                      "prompt": "两人独立编码后比较分歧，记录定义修订和反例。",
                      "minimumItems": 6,
                      "categories": [
                        "知识与认知",
                        "支持理由",
                        "担忧与成本",
                        "执行条件",
                        "例外",
                        "其他"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "匿名数据、退出记录、编码本和分歧处理完整",
            "passCondition": "匿名数据、退出记录、编码本和分歧处理完整",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_003/assets/placeholders/task.svg",
            "location": {
              "mode": "point",
              "legacyMode": "approved_scope",
              "name": "教师批准的调查空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "teacher",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 2,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "social-report-findings",
            "roleStageId": "social-report-findings",
            "name": "提交社会调查报告",
            "phase": "Phase 5 起草听证与修订",
            "modules": "",
            "tools": [],
            "requirement": "呈现主题、反例、样本边界和对条款的条件化含义",
            "guidanceSteps": [
              "写方法、样本范围、主题、反例、缺席群体、局限和条款含义",
              "由未接触身份信息的同伴抽查编码与报告，记录修订和删除"
            ],
            "steps": [
              {
                "id": "social-compose-report",
                "title": "撰写匿名报告",
                "objective": "把社会材料转成有边界的规则输入",
                "studentAction": "写方法、样本范围、主题、反例、缺席群体、局限和条款含义",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少4个匿名引文/记录编号、2个反例或分歧、1个未代表群体",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(社会调查报告)",
                "next": "step:social-member-check",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 6,
                      "accept": "image/*",
                      "recognition": "course-evidence"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "social-report",
                          "label": "社会调查报告",
                          "type": "long_text",
                          "required": true,
                          "minLength": 350
                        },
                        {
                          "id": "limitations",
                          "label": "样本与伦理局限",
                          "type": "long_text",
                          "required": true,
                          "minLength": 100
                        }
                      ]
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  }
                ]
              },
              {
                "id": "social-member-check",
                "title": "完成成员与伦理复核",
                "objective": "检查解释是否忠于匿名材料并保持边界",
                "studentAction": "由未接触身份信息的同伴抽查编码与报告，记录修订和删除",
                "completionMode": "teacher_confirm",
                "evidenceRequirement": "至少3条抽查记录、去标识确认和删除/修订日志",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A05(匿名复核)",
                "next": "role:complete",
                "tools": [
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "ethical_review",
                      "prompt": "只使用匿名编号，核对主题、反例、代表性和重新识别风险；完成后交由教师确认公开材料去标识、同意范围匹配、撤回已执行。",
                      "minimumEntries": 3,
                      "roles": []
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "teacher_confirm",
            "evidenceRequirement": "报告不暴露身份、不夸大代表性，并接受成员核验",
            "passCondition": "报告不暴露身份、不夸大代表性，并接受成员核验",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_003/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 1,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_zhizhi_003/assets/placeholders/role-card.svg",
        "badgeImage": "lessons/lesson_zhizhi_003/assets/placeholders/badge.svg"
      },
      {
        "id": "impact-assessor",
        "order": 5,
        "name": "影响评估员",
        "question": "不同措施组合会带来怎样的风险变化、成本、执行负担与公平影响？",
        "selectionDescription": "建立风险基线，公开成本效果假设，模拟措施组合与例外条件。",
        "location": "调查点位与教育空间",
        "geofence": "教师批准路线和资料范围",
        "type": "核心角色",
        "collectionItem": "评估章",
        "collectionItemImage": "lessons/lesson_zhizhi_003/assets/placeholders/token.svg",
        "tasks": [
          {
            "id": "impact-define-framework",
            "roleStageId": "impact-define-framework",
            "name": "定义评估框架",
            "phase": "Phase 1 问题界定",
            "modules": "",
            "tools": [],
            "requirement": "明确基线、措施单位、成本、效果、公平和不确定性字段",
            "guidanceSteps": [
              "分别定义鸟类风险、建筑使用、成本和执行四类结果及基线需求",
              "为候选参数标来源类型、数值/区间、适用范围和敏感性"
            ],
            "steps": [
              {
                "id": "impact-set-baseline",
                "title": "定义结果与基线",
                "objective": "说明措施希望改变什么，当前状态怎样记录",
                "studentAction": "分别定义鸟类风险、建筑使用、成本和执行四类结果及基线需求",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "四类结果均有指标、单位、时间范围和所需来源",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(评估框架)",
                "next": "step:impact-record-assumptions",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "evaluation_framework",
                      "items": [],
                      "zones": [],
                      "connections": [],
                      "prompt": "为风险、建筑使用、成本、执行定义指标、单位、时间和来源。",
                      "minimumItems": 4,
                      "categories": [
                        "鸟类风险",
                        "建筑使用",
                        "成本维护",
                        "执行管理"
                      ]
                    }
                  }
                ]
              },
              {
                "id": "impact-record-assumptions",
                "title": "建立假设账本",
                "objective": "区分实测参数、资料参数、专家判断和课程假设",
                "studentAction": "为候选参数标来源类型、数值/区间、适用范围和敏感性",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少6个参数；每个有来源类型和不确定性",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(参数账本)",
                "next": "role-stage:impact-model-options",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 6,
                      "accept": "image/*",
                      "recognition": "course-evidence"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "assumptions",
                          "label": "成本效果参数与假设账本",
                          "type": "long_text",
                          "required": true,
                          "minLength": 180
                        }
                      ]
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "形成评估问题、参数表和不确定性记录规则",
            "passCondition": "形成评估问题、参数表和不确定性记录规则",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_003/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 1,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "impact-model-options",
            "roleStageId": "impact-model-options",
            "name": "模拟措施组合",
            "phase": "Phase 5 起草听证与修订",
            "modules": "",
            "tools": [],
            "requirement": "比较玻璃、照明、监测与管理组合，并测试预算和建筑例外",
            "guidanceSteps": [
              "设计基础、重点和强化三种组合，填写覆盖、预期效果、成本、维护和执行主体",
              "改变预算、效果或维护参数，记录推荐变化及受影响群体"
            ],
            "steps": [
              {
                "id": "impact-build-scenarios",
                "title": "构建三种措施组合",
                "objective": "让措施强度、覆盖与成本可以比较",
                "studentAction": "设计基础、重点和强化三种组合，填写覆盖、预期效果、成本、维护和执行主体",
                "completionMode": "tool_result",
                "evidenceRequirement": "3种组合字段完整；所有数值能回到假设账本",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A04(成本效果模拟)",
                "next": "step:impact-test-sensitivity",
                "tools": [
                  {
                    "id": "simulation",
                    "module": "A04",
                    "name": "沙盘推演",
                    "icon": "waves",
                    "output": "rounds",
                    "config": {
                      "rounds": 1,
                      "resources": {},
                      "choices": [],
                      "metrics": [],
                      "mode": "cost_effectiveness",
                      "prompt": "比较基础、重点、强化三种组合；所有参数标来源或课程假设。",
                      "minimumItems": 3,
                      "dimensions": [
                        "覆盖",
                        "风险变化",
                        "初始成本",
                        "维护成本",
                        "执行负担"
                      ]
                    }
                  }
                ]
              },
              {
                "id": "impact-test-sensitivity",
                "title": "测试敏感性与公平性",
                "objective": "识别哪些假设变化会改变推荐",
                "studentAction": "改变预算、效果或维护参数，记录推荐变化及受影响群体",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少2种参数变化、1个推荐反转/不变理由、2类相关者影响和例外建议",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A04(敏感性模拟), A01(影响记录)",
                "next": "role-stage:impact-deliver-assessment",
                "tools": [
                  {
                    "id": "simulation",
                    "module": "A04",
                    "name": "沙盘推演",
                    "icon": "waves",
                    "output": "rounds",
                    "config": {
                      "rounds": 1,
                      "resources": {},
                      "choices": [],
                      "metrics": [],
                      "mode": "sensitivity",
                      "prompt": "分别改变预算、预期效果或维护负担，观察排序是否改变。",
                      "variables": [
                        "预算",
                        "风险变化",
                        "维护负担"
                      ]
                    }
                  },
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 6,
                      "accept": "image/*",
                      "recognition": "course-evidence"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "equity",
                          "label": "相关者影响、例外与调整",
                          "type": "long_text",
                          "required": true,
                          "minLength": 100
                        }
                      ]
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "至少3种组合、2种情境和敏感性分析完成",
            "passCondition": "至少3种组合、2种情境和敏感性分析完成",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_003/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 2,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "impact-deliver-assessment",
            "roleStageId": "impact-deliver-assessment",
            "name": "交付影响评估",
            "phase": "Phase 5 起草听证与修订",
            "modules": "",
            "tools": [],
            "requirement": "向听证会公开推荐、假设、成本承担、例外与复核触发",
            "guidanceSteps": [
              "报告基线、组合、结果区间、敏感参数、公平影响、例外和复核建议",
              "回应至少一条预算质询和一条公平性质询，记录条款影响"
            ],
            "steps": [
              {
                "id": "impact-compose-report",
                "title": "撰写影响评估报告",
                "objective": "用透明假设支持条款选择",
                "studentAction": "报告基线、组合、结果区间、敏感参数、公平影响、例外和复核建议",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少6个参数编号、3种组合、2个局限和1个复核触发条件",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(影响评估报告)",
                "next": "step:impact-answer-hearing",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 6,
                      "accept": "image/*",
                      "recognition": "course-evidence"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "impact-report",
                          "label": "影响评估报告",
                          "type": "long_text",
                          "required": true,
                          "minLength": 350
                        },
                        {
                          "id": "uncertainty",
                          "label": "不确定性与复核触发",
                          "type": "long_text",
                          "required": true,
                          "minLength": 80
                        }
                      ]
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  }
                ]
              },
              {
                "id": "impact-answer-hearing",
                "title": "回应预算与公平质询",
                "objective": "让成本与分配选择接受公开挑战",
                "studentAction": "回应至少一条预算质询和一条公平性质询，记录条款影响",
                "completionMode": "tool_result",
                "evidenceRequirement": "两条质询均有参数化回应、处置状态和条款位置",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A05(听证)",
                "next": "role:complete",
                "tools": [
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "hearing",
                      "prompt": "分别从预算可行性和成本公平性提出质询。",
                      "minimumEntries": 2,
                      "roles": [],
                      "recordTypes": [
                        "预算质询",
                        "公平性质询"
                      ],
                      "requiredRecordTypes": [
                        "预算质询",
                        "公平性质询"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "报告能追溯到参数并回应一次预算/公平质询",
            "passCondition": "报告能追溯到参数并回应一次预算/公平质询",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_003/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 1,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_zhizhi_003/assets/placeholders/role-card.svg",
        "badgeImage": "lessons/lesson_zhizhi_003/assets/placeholders/badge.svg"
      },
      {
        "id": "drafting-coordinator",
        "order": 6,
        "name": "规则起草与程序协调员",
        "question": "怎样把四线证据转成权责清楚、程序完整、允许例外与复核的建议稿？",
        "selectionDescription": "管理证据包、规则五问、三稿修订、听证表决和真实状态披露。",
        "location": "教育空间与经批准的发布场所",
        "geofence": "课程批准的协作与发布范围",
        "type": "核心角色",
        "collectionItem": "程序章",
        "collectionItemImage": "lessons/lesson_zhizhi_003/assets/placeholders/token.svg",
        "tasks": [
          {
            "id": "drafting-set-procedure",
            "roleStageId": "drafting-set-procedure",
            "name": "建立程序与证据协议",
            "phase": "Phase 1 问题界定",
            "modules": "",
            "tools": [],
            "requirement": "提前确定证据进入、利益冲突、听证、修订、表决与AI披露规则",
            "guidanceSteps": [
              "为科学、规范、社会、影响四线分别定义最低产物、复核人和待核处理",
              "制定日历、意见处置、回避/利益披露、表决方式、少数意见和AI披露规则"
            ],
            "steps": [
              {
                "id": "drafting-define-evidence-gate",
                "title": "定义四线证据闸门",
                "objective": "防止条款在证据尚未形成时提前定案",
                "studentAction": "为科学、规范、社会、影响四线分别定义最低产物、复核人和待核处理",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "四线均有产物、来源、复核、局限和未通过处理",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(证据闸门)",
                "next": "step:drafting-adopt-procedure",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "evidence_gate",
                      "items": [],
                      "zones": [],
                      "connections": [],
                      "prompt": "为四线设置最低产物、复核人、局限和待核处理。",
                      "minimumItems": 4,
                      "categories": [
                        "科学与风险",
                        "中国与域外规范",
                        "社会调查",
                        "成本与影响"
                      ]
                    }
                  }
                ]
              },
              {
                "id": "drafting-adopt-procedure",
                "title": "通过研究程序",
                "objective": "让听证、修订、表决和发布有预先规则",
                "studentAction": "制定日历、意见处置、回避/利益披露、表决方式、少数意见和AI披露规则",
                "completionMode": "teacher_confirm",
                "evidenceRequirement": "全组确认记录与教师审批；真实提交需另行授权",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A05(小组协商)",
                "next": "role-stage:drafting-three-drafts",
                "tools": [
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "consensus",
                      "prompt": "逐项确认程序日历、意见处置、回避、表决、少数意见和AI披露；完成后交由教师核对研究伦理、程序公平、发布边界和真实沟通授权。",
                      "minimumEntries": 6,
                      "roles": []
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "程序日历、四线证据闸门和研究诚信协议经全组确认",
            "passCondition": "程序日历、四线证据闸门和研究诚信协议经全组确认",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_003/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 1,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "drafting-three-drafts",
            "roleStageId": "drafting-three-drafts",
            "name": "主持三稿与听证",
            "phase": "Phase 5 起草听证与修订",
            "modules": "",
            "tools": [],
            "requirement": "用规则五问和九要素起草，每条绑定证据，完成公开听证与版本处置",
            "guidanceSteps": [
              "按九要素起草，每条标四线证据、课程价值选择、责任主体和待核",
              "主持四视角听证，登记意见，形成听证稿和终稿三稿对照"
            ],
            "steps": [
              {
                "id": "drafting-compose-first",
                "title": "生成证据绑定初稿",
                "objective": "形成可被质询的完整规则结构",
                "studentAction": "按九要素起草，每条标四线证据、课程价值选择、责任主体和待核",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "九要素齐全；每条至少1个证据编号；事实依据与价值选择分开",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(条款编辑器)",
                "next": "step:drafting-run-hearing",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 6,
                      "accept": "image/*",
                      "recognition": "course-evidence"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "draft-1",
                          "label": "建议稿初稿",
                          "type": "long_text",
                          "required": true,
                          "minLength": 700
                        },
                        {
                          "id": "evidence-index",
                          "label": "逐条证据与价值选择索引",
                          "type": "long_text",
                          "required": true,
                          "minLength": 250
                        }
                      ]
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  }
                ]
              },
              {
                "id": "drafting-run-hearing",
                "title": "听证并完成三稿对照",
                "objective": "让反对意见真正影响版本或留下不采纳理由",
                "studentAction": "主持四视角听证，登记意见，形成听证稿和终稿三稿对照",
                "completionMode": "tool_result",
                "evidenceRequirement": "至少8条意见；每条有证据、回应、状态、理由和修改位置",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A05(模拟听证), A05(三稿对照)",
                "next": "role-stage:drafting-vote-release",
                "tools": [
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "formal_hearing",
                      "prompt": "从科学、管理、使用者、权益与公平视角质询具体条款。",
                      "minimumEntries": 8,
                      "roles": []
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "初稿、听证稿、终稿与逐条证据、意见处置完整",
            "passCondition": "初稿、听证稿、终稿与逐条证据、意见处置完整",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_003/assets/placeholders/task.svg",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 3,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "drafting-vote-release",
            "roleStageId": "drafting-vote-release",
            "name": "组织表决与真实转化",
            "phase": "Phase 6 表决发布与真实转化",
            "modules": "",
            "tools": [],
            "requirement": "完成终审、课程表决、少数意见、AI披露和真实状态记录",
            "guidanceSteps": [
              "逐项检查九要素、来源、人工签注、匿名、AI披露和效力声明，再组织课程表决",
              "发布建议稿、证据包、三稿对照、少数意见和AI披露；获授权后可提交机构"
            ],
            "steps": [
              {
                "id": "drafting-final-audit-vote",
                "title": "完成发布前终审与表决",
                "objective": "确认建议稿科学、规范、伦理与程序边界",
                "studentAction": "逐项检查九要素、来源、人工签注、匿名、AI披露和效力声明，再组织课程表决",
                "completionMode": "teacher_confirm",
                "evidenceRequirement": "终审清单、赞成/反对/弃权计数、理由和少数意见齐全",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A05(表决)",
                "next": "step:drafting-publish-status",
                "tools": [
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "vote",
                      "prompt": "记录票型与可选理由；表决只代表课程内部选择。完成后交由教师核对科学、规范、伦理、程序、AI披露及“青少年建议稿”效力声明。",
                      "minimumEntries": 1,
                      "roles": [],
                      "options": [
                        "赞成",
                        "反对",
                        "弃权"
                      ],
                      "recordMinorityOpinion": true
                    }
                  }
                ]
              },
              {
                "id": "drafting-publish-status",
                "title": "发布并记录真实状态",
                "objective": "让课程成果与外部沟通状态真实可核",
                "studentAction": "发布建议稿、证据包、三稿对照、少数意见和AI披露；获授权后可提交机构",
                "completionMode": "tool_result",
                "evidenceRequirement": "发布包完整；状态只选课程通过、已提交、已接收、反馈中、采纳/未采纳中真实发生项",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(发布包), A05(状态记录)",
                "next": "role:complete",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 6,
                      "accept": "image/*",
                      "recognition": "course-evidence"
                    }
                  },
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 3,
                      "maxSeconds": 90,
                      "language": "zh-CN",
                      "transcribe": true
                    }
                  },
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "release-note",
                          "label": "发布说明、AI披露与未解问题",
                          "type": "long_text",
                          "required": true,
                          "minLength": 180
                        }
                      ]
                    }
                  },
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 420,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": ""
                    }
                  },
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "status_log",
                      "prompt": "分别记录课程表决、提交、接收、反馈和采纳的真实状态与日期。",
                      "minimumEntries": 1,
                      "roles": []
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "teacher_confirm",
            "evidenceRequirement": "发布包通过人工终审，表决与外部状态准确分开",
            "passCondition": "发布包通过人工终审，表决与外部状态准确分开",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhizhi_003/assets/placeholders/task.svg",
            "location": {
              "mode": "point",
              "legacyMode": "approved_scope",
              "name": "教育空间或经批准的发布场所",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 1,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_zhizhi_003/assets/placeholders/role-card.svg",
        "badgeImage": "lessons/lesson_zhizhi_003/assets/placeholders/badge.svg"
      }
    ],
    "timeBank": {
      "enabled": true,
      "initialBalance": 0,
      "currencyUnit": "分钟",
      "earnRules": {
        "maxTotal": 18,
        "maxPerTask": 3,
        "tasksVisibleAtOnce": 3
      },
      "giftRules": {
        "allowGiftToSelf": false,
        "maxPerAction": 5,
        "minAmount": 1,
        "target": "same_group_only"
      },
      "tasks": [
        {
          "id": "tb-01",
          "type": "quiz",
          "question": "一次巡查没有发现鸟撞痕迹时，最合适的记录方式是什么？",
          "options": [
            "照实记录零发现及巡查条件",
            "删除这次记录",
            "宣布建筑绝对安全"
          ],
          "answerType": "",
          "hint": "",
          "reward": 3,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-02",
          "type": "quiz",
          "question": "发现玻璃反射树木后，可以直接得出什么结论？",
          "options": [
            "这是一个需要继续核验的风险变量",
            "这里一定发生过鸟撞",
            "必须立刻拆除整栋建筑"
          ],
          "answerType": "",
          "hint": "",
          "reward": 3,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-03",
          "type": "quiz",
          "question": "比较多伦多、纽约和旧金山材料时，哪种做法更合适？",
          "options": [
            "先比较适用对象和措施再讨论借鉴",
            "直接复制最严格条文",
            "只看文件标题"
          ],
          "answerType": "",
          "hint": "",
          "reward": 3,
          "unlockAfter": "phase3-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-04",
          "type": "photo_checkpoint",
          "question": "拍下一处可能产生反射或透明通道的玻璃局部，并避开可识别的人脸、门牌和个人信息",
          "options": [],
          "answerType": "",
          "hint": "仅在获准区域、确保人身安全的前提下拍摄；不可拍摄时改画风险草图并由教师确认",
          "reward": 3,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-05",
          "type": "quiz",
          "question": "写出一个可能影响巡查结果的变量，并说明下一轮怎样控制或记录它。",
          "options": [],
          "answerType": "open_ended",
          "hint": "",
          "reward": 3,
          "unlockAfter": "phase2-start",
          "minLength": 35,
          "requiresText": false
        },
        {
          "id": "tb-06",
          "type": "quiz",
          "question": "选择建议稿中的一条措施，补写责任主体、执行成本和复核周期。",
          "options": [],
          "answerType": "open_ended",
          "hint": "",
          "reward": 3,
          "unlockAfter": "phase5-start",
          "minLength": 40,
          "requiresText": false
        }
      ]
    },
    "assets": {
      "cover": "lessons/lesson_zhizhi_003/assets/placeholders/cover.svg",
      "chat": "lessons/lesson_zhizhi_003/assets/placeholders/chat-bg.svg",
      "transition": "lessons/lesson_zhizhi_003/assets/placeholders/phase-transition.svg",
      "certificate": "lessons/lesson_zhizhi_003/assets/placeholders/certificate.svg",
      "navigationMap": "lessons/lesson_zhizhi_003/assets/placeholders/navigation-map.svg",
      "importPlaceholder": "lessons/lesson_zhizhi_003/assets/placeholders/opening.svg",
      "simulationPlaceholder": "lessons/lesson_zhizhi_003/assets/placeholders/simulation.svg"
    }
  },
  "lesson_zhuhun_001": {
    "id": "lesson_zhuhun_001",
    "title": "得意之笔·四渡赤水",
    "subtitle": "在中国共产党历史展览馆，用证据完成一场战略推演",
    "series": "铸魂",
    "seriesCode": "zhuhun",
    "themeTemplate": "zhuhun",
    "venue": "中国共产党历史展览馆",
    "mapCenter": [
      116.3953,
      40.0071
    ],
    "duration": "5.5小时（含参观、午休与集合）",
    "grades": "小学中高年级 / 初中 / 高中",
    "groupRule": "5人一组，每人一个推演角色",
    "level": "",
    "levelCode": "",
    "traversalMode": "sequential",
    "coreQuestion": "面对悬殊兵力与不断变化的局势，四渡赤水这支“得意之笔”究竟得意在哪里？",
    "phases": [
      {
        "id": "phase-1",
        "number": 1,
        "name": "局势入场",
        "duration": "25min",
        "mode": "集体（全班）",
        "location": "集合教室或展馆指定教育空间",
        "modules": "A06(沉浸媒体), A01(文字输入)",
        "trigger": "教师手动启动",
        "endCondition": "完成开场影片 + 提交初始判断",
        "flow": [
          "播放“3万对40万”局势导入影片或占位内容",
          "絮絮说明自己是AI学习同伴，本课以电子参谋员身份只按本轮可见情报协助推演",
          "学生阅读1935年1月遵义会议后的初始态势卡",
          "学生提交初始选择：继续北渡、原地作战、向东转移或暂不决策",
          "AI只追问判断依据，不公布后续四渡路线",
          "教师开放角色选择页"
        ],
        "tasks": [
          {
            "id": "phase-1-task-1",
            "roleStageId": "",
            "name": "提交局势初始判断",
            "phase": "课程任务",
            "modules": "A01(文字表单)",
            "tools": [
              {
                "id": "text",
                "module": "A01",
                "name": "文字表单",
                "icon": "notebook-pen",
                "output": "fields",
                "config": {
                  "fields": [
                    {
                      "id": "choice",
                      "label": "我的初始方案",
                      "type": "select",
                      "options": [
                        "继续北渡",
                        "原地作战",
                        "向东转移",
                        "暂不决策"
                      ],
                      "required": true
                    },
                    {
                      "id": "evidence",
                      "label": "我依据的态势证据",
                      "type": "long_text",
                      "required": true,
                      "minLength": 20,
                      "maxLength": 180
                    },
                    {
                      "id": "uncertainty",
                      "label": "我仍不确定的信息",
                      "type": "long_text",
                      "required": true,
                      "minLength": 10,
                      "maxLength": 120
                    }
                  ]
                }
              }
            ],
            "requirement": "阅读教师展示的1935年1月初始态势卡，选择当前方案并写出证据与不确定性",
            "guidanceSteps": [
              "选择当前方案，填写态势证据与仍不确定的信息"
            ],
            "steps": [
              {
                "id": "phase-1-task-1-step-1",
                "title": "留下推演前判断",
                "objective": "保存后续复盘可对照的初始判断与证据",
                "studentAction": "选择当前方案，填写态势证据与仍不确定的信息",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "方案、至少一条态势证据和一项不确定性齐全",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字表单)",
                "next": "role-stage:complete",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "choice",
                          "label": "我的初始方案",
                          "type": "select",
                          "options": [
                            "继续北渡",
                            "原地作战",
                            "向东转移",
                            "暂不决策"
                          ],
                          "required": true
                        },
                        {
                          "id": "evidence",
                          "label": "我依据的态势证据",
                          "type": "long_text",
                          "required": true,
                          "minLength": 20,
                          "maxLength": 180
                        },
                        {
                          "id": "uncertainty",
                          "label": "我仍不确定的信息",
                          "type": "long_text",
                          "required": true,
                          "minLength": 10,
                          "maxLength": 120
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "ai_evaluation",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "选择一项方案，并写出至少一条态势证据和一项不确定性",
            "passCondition": "方案、至少一条态势证据和一项不确定性齐全；是否符合后续史实不影响通过",
            "goals": "",
            "prerequisites": [],
            "toolType": "text",
            "image": "",
            "location": {
              "mode": "none",
              "legacyMode": "none",
              "name": "集合教室或展馆指定教育空间",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "",
              "verification": "none",
              "minDwellSeconds": 0
            },
            "timing": {
              "suggestedSeconds": 360,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation",
            "scope": "phase",
            "phaseId": "phase-1",
            "executor": "个人"
          }
        ]
      },
      {
        "id": "phase-2",
        "number": 2,
        "name": "展陈采证",
        "duration": "120min",
        "mode": "个人角色任务 + 同角色短协作",
        "location": "中国共产党历史展览馆长征相关展区",
        "modules": "A01(多模态采集), A02(答题评测), A07(扫码), 位置导航",
        "trigger": "Phase 1结束 + 教师确认",
        "endCondition": "教师手动推进或采证时间结束",
        "flow": [
          "AI根据角色显示馆内动线与安全提示",
          "五种角色分别完成3个递进任务",
          "每条证据必须标记：展项/权威资料/课程材料/个人推测",
          "完成核心任务后获得对应战图图层",
          "时间银行分支任务可并行进行"
        ],
        "tasks": []
      },
      {
        "id": "phase-3",
        "number": 3,
        "name": "四渡推演",
        "duration": "60min",
        "mode": "小组协作",
        "location": "馆内教育空间或返程后的学习空间",
        "modules": "A03(拼合搭建), A04(兵棋推演), A05(讨论记录)",
        "trigger": "Phase 2结束",
        "endCondition": "完成四轮决策与证据复盘",
        "flow": [
          "五层战图叠合，显示各角色证据但隐藏史实结果",
          "系统依次冻结在一渡、二渡、三渡、四渡前的时间点",
          "每轮只开放当时已经掌握的情报",
          "小组提交“目标—约束—方案—风险—预期敌方反应”",
          "系统再开放下一段史实，要求标记原判断保留或修正",
          "通讯兵记录：基层执行者实际能看到多少信息"
        ],
        "tasks": []
      },
      {
        "id": "phase-4",
        "number": 4,
        "name": "璇玑时刻",
        "duration": "30min",
        "mode": "小组讨论 → 全班交流",
        "location": "学习空间",
        "modules": "A06(沉浸媒体), A04(双视角整合), A01(语音/文字)",
        "trigger": "Phase 3完成或教师解锁",
        "endCondition": "完成双视角回应",
        "flow": [
          "战图从“全局指挥视角”切换为“基层士兵有限视角”",
          "展示本阶段解锁的双视角课程情境材料，并明确标注出处待核",
          "学生回答：看不到全局时，一个人凭什么判断、行动和坚持",
          "AI要求区分史实证据、情境推断与价值判断",
          "小组形成双栏结论：战略层的行动逻辑 / 个体层的行动依据"
        ],
        "tasks": []
      },
      {
        "id": "phase-5",
        "number": 5,
        "name": "得意何在",
        "duration": "30min",
        "mode": "小组汇报 + 集体讲解",
        "location": "学习空间",
        "modules": "A01(文字/语音), A05(小组对比)",
        "trigger": "Phase 4结束",
        "endCondition": "每组形成带证据的核心判断",
        "flow": [
          "每组用3分钟回答核心问题",
          "AI按“证据—判断—边界”整理各组差异，不做排名",
          "教师补充四渡赤水与遵义会议后独立自主、实事求是的历史意义",
          "回看初始方案，记录至少一次判断变化及触发它的证据",
          "完成迁移题：现实中何时应该坚持，何时应该调整方案"
        ],
        "tasks": []
      },
      {
        "id": "phase-6",
        "number": 6,
        "name": "归档与尾声",
        "duration": "10min",
        "mode": "个人",
        "location": "学习空间",
        "modules": "学习报告",
        "trigger": "Phase 5结束",
        "endCondition": "报告预览生成",
        "flow": [
          "AI生成个人推演轨迹：初始判断、证据贡献、修正节点和最终结论",
          "学生确认哪些内容是史实、推断或价值表达",
          "絮絮告别并提醒：历史判断需要持续回到证据",
          "课程结束标记"
        ],
        "tasks": []
      }
    ],
    "roleSystem": {
      "collectionName": "推演角色",
      "itemName": "身份",
      "pickerEyebrow": "{roleCount}种推演身份 · {roleCount}层战图证据",
      "pickerTitle": "选择你的推演身份",
      "pickerDescription": "每位成员负责一种观察视角。教师核对{roleCount}层{collectionItemName}已汇集后，组织小组共同还原四渡赤水的决策链。",
      "collectionItemName": "战图图层",
      "collectionPanelName": "五层战图",
      "unlockTarget": "璇玑时刻",
      "phaseId": "phase-2"
    },
    "learningView": {
      "enabled": true,
      "default": "dialogue",
      "allowStudentSwitch": true
    },
    "roles": [
      {
        "id": "map-strategist",
        "order": 1,
        "name": "地图参谋",
        "question": "山脉、河流与渡口怎样改变一支队伍可以选择的路？",
        "selectionDescription": "负责读懂川黔滇地形，把河流、渡口、山地和敌我位置整理成可推演的战场底图。",
        "location": "长征路线地图与模型展区",
        "geofence": "中国共产党历史展览馆课程动线内",
        "type": "核心角色",
        "collectionItem": "地形层",
        "collectionItemImage": "lessons/lesson_zhuhun_001/assets/tokens/layer-terrain.png",
        "tasks": [
          {
            "id": "task-1",
            "roleStageId": "task-1",
            "name": "定坐标",
            "phase": "Phase 2 展陈采证",
            "modules": "A01(拍照采集), A07(扫码), 位置导航",
            "tools": [
              {
                "id": "photo",
                "module": "A01",
                "name": "拍照采集",
                "icon": "camera",
                "output": "files",
                "config": {
                  "minCount": 1,
                  "maxCount": 6,
                  "accept": "image/*",
                  "recognition": "course-evidence"
                }
              },
              {
                "id": "scanner",
                "module": "A07",
                "name": "扫码识别",
                "icon": "scan-line",
                "output": "scanResult",
                "config": {
                  "mode": "qr",
                  "allowManualEntry": true,
                  "prompt": ""
                }
              }
            ],
            "requirement": "找到长征路线地图或地形模型，拍摄至少2处允许拍摄的局部；分别标注赤水河、乌江、长江、金沙江中能够辨认的水系，并记录展项标题",
            "guidanceSteps": [
              "对准展项整体和标题区域完成一次实物识别",
              "拍摄一张地图全景和一张能看清河流名称或图例的局部照片",
              "在课程底图上圈出至少两条能够确认的水系，并用箭头标出它们的相对方向"
            ],
            "steps": [
              {
                "id": "map-locate-exhibit",
                "title": "确认地图展项",
                "objective": "确认眼前展项属于本角色需要观察的长征路线地图或地形模型",
                "studentAction": "对准展项整体和标题区域完成一次实物识别",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "识别画面需同时包含地图或模型主体，以及可定位该展项的标题或说明区域",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A07(实物识别)",
                "next": "step:map-capture-water-system",
                "tools": [
                  {
                    "id": "scanner",
                    "module": "A07",
                    "name": "扫码识别",
                    "icon": "scan-line",
                    "output": "scanResult",
                    "config": {
                      "mode": "object",
                      "allowManualEntry": false,
                      "prompt": "请把地图或地形模型主体与展项标题一起放入画面，完成一次实物识别。"
                    }
                  }
                ]
              },
              {
                "id": "map-capture-water-system",
                "title": "采集水系证据",
                "objective": "获得能够支持水系相对位置判断的现场图像证据",
                "studentAction": "拍摄一张地图全景和一张能看清河流名称或图例的局部照片",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少2张照片；一张保留地图整体方向，一张清楚呈现至少一个河流名称或水系图例；不得拍入其他参观者正脸",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(拍照)",
                "next": "step:map-annotate-water-system",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 2,
                      "maxCount": 4,
                      "accept": "image/*",
                      "recognition": "map-source-and-waterway",
                      "prompt": "先拍地图全景，再拍河流名称或图例局部；两张照片都要保留可核对的展项信息。"
                    }
                  }
                ]
              },
              {
                "id": "map-annotate-water-system",
                "title": "标出可确认水系",
                "objective": "依据现场证据建立地图方向和水系相对位置",
                "studentAction": "在课程底图上圈出至少两条能够确认的水系，并用箭头标出它们的相对方向",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "画板中至少出现2个水系标注、1组相对方向箭头，并能对应本阶段照片；无法确认的名称写“待核”。",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(画板标注)",
                "next": "role-stage:task-2",
                "tools": [
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 520,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": "lessons/lesson_zhuhun_001/assets/tasks/terrain-map.svg",
                      "prompt": "红色圈水系名称，绿色画相对方向，黑色写照片编号；看不清的地方标“待核”。"
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "至少2张有效证据照片 + 1条展项来源 + 至少2个正确空间标注",
            "passCondition": "至少2张有效证据照片 + 1条展项来源 + 至少2个正确空间标注",
            "goals": "K1(时空坐标), S1(地图判读), S3(史料实证)",
            "prerequisites": [],
            "toolType": "capture",
            "image": "lessons/lesson_zhuhun_001/assets/tasks/terrain-map.svg",
            "location": {
              "mode": "point",
              "legacyMode": "inherit_role",
              "name": "长征路线地图与模型展区",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "中国共产党历史展览馆课程动线内",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "task-2",
            "roleStageId": "task-2",
            "name": "布态势",
            "phase": "Phase 2 展陈采证",
            "modules": "A01(画板标注), A01(文字输入)",
            "tools": [
              {
                "id": "sketch",
                "module": "A01",
                "name": "画板标注",
                "icon": "pen-tool",
                "output": "image",
                "config": {
                  "width": 720,
                  "height": 420,
                  "brushColors": [
                    "#8d211f",
                    "#245c4f",
                    "#1f2937"
                  ],
                  "backgroundImage": ""
                }
              },
              {
                "id": "text",
                "module": "A01",
                "name": "文字表单",
                "icon": "notebook-pen",
                "output": "fields",
                "config": {
                  "fields": [
                    {
                      "id": "observation",
                      "label": "观察记录",
                      "type": "long_text",
                      "required": true
                    }
                  ]
                }
              }
            ],
            "requirement": "在空白底图上标出红军所在区域、敌军可能形成的封锁方向、至少2个渡河点候选和1处地形约束；每个标记附一句证据说明",
            "guidanceSteps": [
              "把红军区域、敌军封锁方向、两个候选渡口和一处地形约束卡分别放入对应区域",
              "在底图上用实线标现场可确认信息，用虚线标个人推演，并画出至少一个被河流或山地阻断的位置",
              "分别写下一条“能否通行”的证据和一条“是否值得走”的判断，并说明仍缺什么信息"
            ],
            "steps": [
              {
                "id": "map-place-situation-cards",
                "title": "摆放态势卡",
                "objective": "把不同类型的空间信息放进同一张态势底图",
                "studentAction": "把红军区域、敌军封锁方向、两个候选渡口和一处地形约束卡分别放入对应区域",
                "completionMode": "tool_result",
                "evidenceRequirement": "6张卡全部进入作品区；每张卡保留“展陈信息”或“推演假设”标签，不得把候选渡口写成史实渡口",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(拼合搭建)",
                "next": "step:map-mark-evidence-boundary",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "evidence-wall",
                      "items": [
                        {
                          "id": "red-area",
                          "label": "红军所在区域｜展陈信息"
                        },
                        {
                          "id": "block-north",
                          "label": "敌军封锁方向A｜待核"
                        },
                        {
                          "id": "crossing-a",
                          "label": "候选渡口A｜推演假设"
                        },
                        {
                          "id": "crossing-b",
                          "label": "候选渡口B｜推演假设"
                        },
                        {
                          "id": "terrain-river",
                          "label": "河流约束｜展陈信息"
                        },
                        {
                          "id": "terrain-mountain",
                          "label": "山地或交通约束｜待核"
                        }
                      ],
                      "zones": [
                        {
                          "id": "confirmed",
                          "label": "展陈可确认"
                        },
                        {
                          "id": "inference",
                          "label": "个人推演"
                        },
                        {
                          "id": "unknown",
                          "label": "仍待核验"
                        }
                      ],
                      "connections": [],
                      "prompt": "先按证据性质分区，再摆放态势卡。红军区域与地形约束需要现场证据；两个渡口仍是候选。"
                    }
                  }
                ]
              },
              {
                "id": "map-mark-evidence-boundary",
                "title": "画出空间关系",
                "objective": "用不同视觉符号区分事实位置、封锁方向和候选路线",
                "studentAction": "在底图上用实线标现场可确认信息，用虚线标个人推演，并画出至少一个被河流或山地阻断的位置",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少包含1个实线事实标记、2个虚线候选标记、1个封锁方向和1处地形阻断；标注与上一步态势卡一致",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(画板标注)",
                "next": "step:map-explain-terrain-constraint",
                "tools": [
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 520,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": "lessons/lesson_zhuhun_001/assets/tasks/terrain-map.svg",
                      "prompt": "红色实线表示展陈可确认，绿色虚线表示推演，黑色叉号标地形阻断。"
                    }
                  }
                ]
              },
              {
                "id": "map-explain-terrain-constraint",
                "title": "解释地形约束",
                "objective": "把地图标记转化为可供小组使用的路线约束",
                "studentAction": "分别写下一条“能否通行”的证据和一条“是否值得走”的判断，并说明仍缺什么信息",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "三个字段全部填写；通行证据引用现场照片或标注图，价值判断使用条件句，缺失信息不得虚构补全",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字表单)",
                "next": "role-stage:task-3",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "passability",
                          "label": "能否通行：现场证据",
                          "type": "long_text",
                          "required": true,
                          "placeholder": "例：照片2显示……因此这段可能/不可能通行"
                        },
                        {
                          "id": "value",
                          "label": "是否值得走：带条件判断",
                          "type": "long_text",
                          "required": true,
                          "placeholder": "只有在……条件满足时，这条方向才值得考虑"
                        },
                        {
                          "id": "missing",
                          "label": "仍缺的信息",
                          "type": "short_text",
                          "required": true,
                          "placeholder": "敌军位置、补给、渡河条件等"
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "完成四类标注 + 至少3条证据说明 + 明确区分展陈信息与个人推断",
            "passCondition": "完成四类标注 + 至少3条证据说明 + 明确区分展陈信息与个人推断",
            "goals": "K2(敌我态势), S1(地图判读), S6(因果表达), C3(证据边界)",
            "prerequisites": [],
            "toolType": "sketch",
            "image": "lessons/lesson_zhuhun_001/assets/tasks/terrain-map.svg",
            "location": {
              "mode": "point",
              "legacyMode": "inherit_role",
              "name": "长征路线地图与模型展区",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "中国共产党历史展览馆课程动线内",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "task-3",
            "roleStageId": "task-3",
            "name": "拟路线",
            "phase": "Phase 2 展陈采证",
            "modules": "A01(画板标注), A02(表单)",
            "tools": [
              {
                "id": "sketch",
                "module": "A01",
                "name": "画板标注",
                "icon": "pen-tool",
                "output": "image",
                "config": {
                  "width": 720,
                  "height": 420,
                  "brushColors": [
                    "#8d211f",
                    "#245c4f",
                    "#1f2937"
                  ],
                  "backgroundImage": ""
                }
              },
              {
                "id": "quiz",
                "module": "A02",
                "name": "答题评测",
                "icon": "list-checks",
                "output": "answers",
                "config": {
                  "type": "open_response",
                  "question": "",
                  "options": []
                }
              }
            ],
            "requirement": "只依据本角色已采集证据，提出一条阶段性转移路线；填写目标、地形优势、主要风险、仍缺信息各1项",
            "guidanceSteps": [
              "从当前起点画到一个候选终点，标出渡河点、转向点和备用出口",
              "根据刚画的路线填写目标、地形优势、主要风险和仍缺信息四项",
              "选择目前最符合你这条路线证据状态的描述"
            ],
            "steps": [
              {
                "id": "map-draw-candidate-route",
                "title": "绘制候选路线",
                "objective": "形成一条基于当前证据、可以被检查的阶段性路线",
                "studentAction": "从当前起点画到一个候选终点，标出渡河点、转向点和备用出口",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "路线连续，至少包含1个渡河点、1个转向点和1个备用出口；不得照抄尚未解锁的史实路线",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(画板标注)",
                "next": "step:map-complete-route-matrix",
                "tools": [
                  {
                    "id": "sketch",
                    "module": "A01",
                    "name": "画板标注",
                    "icon": "pen-tool",
                    "output": "image",
                    "config": {
                      "width": 720,
                      "height": 520,
                      "brushColors": [
                        "#8d211f",
                        "#245c4f",
                        "#1f2937"
                      ],
                      "backgroundImage": "lessons/lesson_zhuhun_001/assets/tasks/terrain-map.svg",
                      "prompt": "用红线画主路线、绿线画备用出口、黑圈标渡河点；这是候选方案，请勿写成史实路线。"
                    }
                  }
                ]
              },
              {
                "id": "map-complete-route-matrix",
                "title": "填写路线矩阵",
                "objective": "说明候选路线的目标、优势、风险和信息边界",
                "studentAction": "根据刚画的路线填写目标、地形优势、主要风险和仍缺信息四项",
                "completionMode": "tool_result",
                "evidenceRequirement": "四个字段均完成；优势和风险各引用至少一个现场观察；未知项保持为未知",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字表单)",
                "next": "step:map-check-route-evidence",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "goal",
                          "label": "阶段目标",
                          "type": "short_text",
                          "required": true,
                          "placeholder": "保存力量、寻找出口、争取补给等"
                        },
                        {
                          "id": "advantage",
                          "label": "地形优势与证据",
                          "type": "long_text",
                          "required": true,
                          "placeholder": "引用照片或标注图说明"
                        },
                        {
                          "id": "risk",
                          "label": "主要风险与证据",
                          "type": "long_text",
                          "required": true,
                          "placeholder": "写出最可能使路线失效的条件"
                        },
                        {
                          "id": "unknown",
                          "label": "仍缺信息",
                          "type": "short_text",
                          "required": true,
                          "placeholder": "当前无法确认的信息"
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "map-check-route-evidence",
                "title": "核对证据充分性",
                "objective": "判断候选路线是否已具备进入小组推演的最低证据条件",
                "studentAction": "选择目前最符合你这条路线证据状态的描述",
                "completionMode": "tool_result",
                "evidenceRequirement": "选择能够同时保留现场证据、风险和未知项的选项",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A02(单选答题)",
                "next": "role-stage:complete",
                "tools": [
                  {
                    "id": "quiz",
                    "module": "A02",
                    "name": "答题评测",
                    "icon": "list-checks",
                    "output": "answers",
                    "config": {
                      "type": "single_choice",
                      "question": "哪一种提交方式最适合把候选路线带入小组推演？",
                      "options": [
                        "路线与史实一致，所以无需再写风险",
                        "引用至少2条现场证据，同时保留主要风险和未知信息",
                        "只要地图上能连起来，就可以认定路线可行"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "提交1条连续路线 + 4项理由完整 + 至少引用2条现场证据",
            "passCondition": "提交1条连续路线 + 4项理由完整 + 至少引用2条现场证据",
            "goals": "K3(四次渡河), S5(决策矩阵), C1(实事求是), C2(战略思维)",
            "prerequisites": [],
            "toolType": "sketch",
            "image": "lessons/lesson_zhuhun_001/assets/tasks/terrain-map.svg",
            "location": {
              "mode": "point",
              "legacyMode": "inherit_role",
              "name": "长征路线地图与模型展区",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "中国共产党历史展览馆课程动线内",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_zhuhun_001/assets/roles/role-card-map-strategist.png",
        "badgeImage": "lessons/lesson_zhuhun_001/assets/roles/badge-map-strategist.png"
      },
      {
        "id": "intelligence-strategist",
        "order": 2,
        "name": "情报参谋",
        "question": "双方掌握的信息不同，怎样让对方根据不完整信息作出错误判断？",
        "selectionDescription": "负责辨认电文和情报线索，画出“我方已知、敌方已知、双方未知与可能误判”的信息盲区。",
        "location": "情报与通信史料展区",
        "geofence": "中国共产党历史展览馆课程动线内",
        "type": "核心角色",
        "collectionItem": "情报层",
        "collectionItemImage": "lessons/lesson_zhuhun_001/assets/tokens/layer-intelligence.png",
        "tasks": [
          {
            "id": "task-1",
            "roleStageId": "task-1",
            "name": "读电文",
            "phase": "Phase 2 展陈采证",
            "modules": "A01(拍照采集), A07(扫码)",
            "tools": [
              {
                "id": "photo",
                "module": "A01",
                "name": "拍照采集",
                "icon": "camera",
                "output": "files",
                "config": {
                  "minCount": 1,
                  "maxCount": 6,
                  "accept": "image/*",
                  "recognition": "course-evidence"
                }
              },
              {
                "id": "scanner",
                "module": "A07",
                "name": "扫码识别",
                "icon": "scan-line",
                "output": "scanResult",
                "config": {
                  "mode": "qr",
                  "allowManualEntry": true,
                  "prompt": ""
                }
              }
            ],
            "requirement": "寻找通信、侦察、电台或电文相关展项，拍摄至少2处允许拍摄的证据；记录发送者、接收者、时间、信息内容中能够确认的项目",
            "guidanceSteps": [
              "拍摄一张通信工具或电文展项全景，再拍一张展项说明局部",
              "逐项填写发送者、接收者、时间、可确认内容和展项来源；看不清或材料未说明时填写“未知”",
              "选择最符合史料边界的记录方式"
            ],
            "steps": [
              {
                "id": "intel-capture-message",
                "title": "采集通信史料",
                "objective": "获得能够确认通信史料内容与来源的现场证据",
                "studentAction": "拍摄一张通信工具或电文展项全景，再拍一张展项说明局部",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少2张照片；全景能确认展项类型，局部能辨认标题、日期、通信主体或说明文字中的至少一项；不得依据模糊字迹补写",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(拍照)",
                "next": "step:intel-confirm-fields",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 2,
                      "maxCount": 4,
                      "accept": "image/*",
                      "recognition": "message-source-fields",
                      "prompt": "先拍展项全景，再拍说明文字局部；文字模糊时换角度，不要凭印象补写。"
                    }
                  }
                ]
              },
              {
                "id": "intel-confirm-fields",
                "title": "确认电文字段",
                "objective": "从现场材料中提取可确认字段，并保留材料未说明的空白",
                "studentAction": "逐项填写发送者、接收者、时间、可确认内容和展项来源；看不清或材料未说明时填写“未知”",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "5个字段均完成，其中至少3项来自照片中可辨认的信息；“未知”允许作为有效记录，禁止补造原句或编号",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字表单)",
                "next": "step:intel-mark-source-boundary",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "sender",
                          "label": "发送者",
                          "type": "short_text",
                          "required": true,
                          "placeholder": "无法确认时填“未知”"
                        },
                        {
                          "id": "receiver",
                          "label": "接收者",
                          "type": "short_text",
                          "required": true,
                          "placeholder": "无法确认时填“未知”"
                        },
                        {
                          "id": "time",
                          "label": "时间",
                          "type": "short_text",
                          "required": true,
                          "placeholder": "按展项原文记录；未知可保留"
                        },
                        {
                          "id": "content",
                          "label": "能够确认的信息内容",
                          "type": "long_text",
                          "required": true,
                          "placeholder": "只转述清晰可见的内容"
                        },
                        {
                          "id": "source",
                          "label": "展项标题或来源",
                          "type": "short_text",
                          "required": true,
                          "placeholder": "填写展项标题、照片编号或说明牌"
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "intel-mark-source-boundary",
                "title": "判断信息边界",
                "objective": "区分展项原文、展陈转述和个人推测",
                "studentAction": "选择最符合史料边界的记录方式",
                "completionMode": "tool_result",
                "evidenceRequirement": "正确选择保留未知、标明来源并将推测单独标注的表达",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A02(单选答题)",
                "next": "role-stage:task-2",
                "tools": [
                  {
                    "id": "quiz",
                    "module": "A02",
                    "name": "答题评测",
                    "icon": "list-checks",
                    "output": "answers",
                    "config": {
                      "type": "single_choice",
                      "question": "照片中有一处字迹模糊，哪种记录方式符合本课证据规则？",
                      "options": [
                        "按上下文补出最可能的原句",
                        "写“该字段未知”，并保留照片编号供复核",
                        "请AI生成一条意思接近的电文原文"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "至少2张有效照片 + 1条展项来源 + 至少3项信息字段；无法确认的字段标记“未知”",
            "passCondition": "至少2张有效照片 + 1条展项来源 + 至少3项信息字段；无法确认的字段标记“未知”",
            "goals": "K4(情报与信息差), S3(史料实证), C3(证据边界)",
            "prerequisites": [],
            "toolType": "capture",
            "image": "lessons/lesson_zhuhun_001/assets/tasks/intelligence-matrix.svg",
            "location": {
              "mode": "point",
              "legacyMode": "inherit_role",
              "name": "情报与通信史料展区",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "中国共产党历史展览馆课程动线内",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "task-2",
            "roleStageId": "task-2",
            "name": "划盲区",
            "phase": "Phase 2 展陈采证",
            "modules": "A02(表单), A01(画板标注)",
            "tools": [
              {
                "id": "quiz",
                "module": "A02",
                "name": "答题评测",
                "icon": "list-checks",
                "output": "answers",
                "config": {
                  "type": "open_response",
                  "question": "",
                  "options": []
                }
              },
              {
                "id": "sketch",
                "module": "A01",
                "name": "画板标注",
                "icon": "pen-tool",
                "output": "image",
                "config": {
                  "width": 720,
                  "height": 420,
                  "brushColors": [
                    "#8d211f",
                    "#245c4f",
                    "#1f2937"
                  ],
                  "backgroundImage": ""
                }
              }
            ],
            "requirement": "把证据放入四象限：我方已知、敌方可能已知、双方未知、敌方可能误判；每项同时填写来源与可靠度（高/中/低）",
            "guidanceSteps": [
              "把任务1形成的5张信息卡分别放入四个象限；同一张卡只能先选择一个当前最合适的位置",
              "分别给5张信息卡选择高、中或低可靠度，并为低可靠度卡写出一种核验办法",
              "选择最符合当前证据的表述"
            ],
            "steps": [
              {
                "id": "intel-sort-information",
                "title": "分类信息卡",
                "objective": "建立我方已知、敌方可能已知、双方未知和敌方可能误判四类信息",
                "studentAction": "把任务1形成的5张信息卡分别放入四个象限；同一张卡只能先选择一个当前最合适的位置",
                "completionMode": "tool_result",
                "evidenceRequirement": "5张卡全部完成分类，四个象限均有记录；“敌方可能已知”保持可能性表述",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(分类搭建)",
                "next": "step:intel-rate-reliability",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "evidence-wall",
                      "items": [
                        {
                          "id": "sender-card",
                          "label": "任务1·发送者字段"
                        },
                        {
                          "id": "receiver-card",
                          "label": "任务1·接收者字段"
                        },
                        {
                          "id": "time-card",
                          "label": "任务1·时间字段"
                        },
                        {
                          "id": "content-card",
                          "label": "任务1·内容字段"
                        },
                        {
                          "id": "signal-card",
                          "label": "展项中可被观察的行动信号"
                        }
                      ],
                      "zones": [
                        {
                          "id": "ours",
                          "label": "我方已知"
                        },
                        {
                          "id": "enemy-maybe",
                          "label": "敌方可能已知"
                        },
                        {
                          "id": "unknown",
                          "label": "双方未知"
                        },
                        {
                          "id": "misread",
                          "label": "敌方可能误判"
                        }
                      ],
                      "connections": [],
                      "prompt": "把来自任务1的字段卡与一个行动信号卡放入四象限；分类依据是当时各方能否获得信息。",
                      "bindings": {
                        "sender-card": {
                          "taskId": "task-1",
                          "stepId": "intel-confirm-fields",
                          "toolId": "text",
                          "fieldId": "sender",
                          "prefix": "发送者："
                        },
                        "receiver-card": {
                          "taskId": "task-1",
                          "stepId": "intel-confirm-fields",
                          "toolId": "text",
                          "fieldId": "receiver",
                          "prefix": "接收者："
                        },
                        "time-card": {
                          "taskId": "task-1",
                          "stepId": "intel-confirm-fields",
                          "toolId": "text",
                          "fieldId": "time",
                          "prefix": "时间："
                        },
                        "content-card": {
                          "taskId": "task-1",
                          "stepId": "intel-confirm-fields",
                          "toolId": "text",
                          "fieldId": "content",
                          "prefix": "内容："
                        }
                      },
                      "zoneMinimums": {
                        "ours": 1,
                        "enemy-maybe": 1,
                        "unknown": 1,
                        "misread": 1
                      }
                    }
                  }
                ]
              },
              {
                "id": "intel-rate-reliability",
                "title": "标记可靠度",
                "objective": "为分类判断补充来源、可靠度和核验办法",
                "studentAction": "分别给5张信息卡选择高、中或低可靠度，并为低可靠度卡写出一种核验办法",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "5张卡均有可靠度；至少1张卡保留低或中可靠度；低可靠度信息填写可执行的核验办法",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字表单)",
                "next": "step:intel-correct-overclaim",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "sender-rating",
                          "label": "发送者字段：可靠度与理由",
                          "type": "short_text",
                          "required": true,
                          "placeholder": "高/中/低 + 照片或来源"
                        },
                        {
                          "id": "receiver-rating",
                          "label": "接收者字段：可靠度与理由",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "time-rating",
                          "label": "时间字段：可靠度与理由",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "content-rating",
                          "label": "内容字段：可靠度与理由",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "signal-rating",
                          "label": "行动信号：可靠度与理由",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "verification-method",
                          "label": "一条低可靠度信息的核验办法",
                          "type": "long_text",
                          "required": true,
                          "placeholder": "回看展项、寻找独立来源或请教师核验"
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "intel-correct-overclaim",
                "title": "修正越界判断",
                "objective": "把关于敌方认知的确定断言改写为带证据边界的判断",
                "studentAction": "选择最符合当前证据的表述",
                "completionMode": "tool_result",
                "evidenceRequirement": "选择同时说明推测性质、依据和替代可能的表达",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A02(单选答题)",
                "next": "role-stage:task-3",
                "tools": [
                  {
                    "id": "quiz",
                    "module": "A02",
                    "name": "答题评测",
                    "icon": "list-checks",
                    "output": "answers",
                    "config": {
                      "type": "single_choice",
                      "question": "只有一条行动信号证据时，怎样记录敌方是否已经知道？",
                      "options": [
                        "敌方一定已经知道，并会按我们预想行动",
                        "根据这条信号，敌方可能知道；还需说明观察渠道和其他解释",
                        "只要我方看得到，敌方就必然看得到"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "四个象限均有记录 + 至少5条信息卡 + 每条含来源和可靠度",
            "passCondition": "四个象限均有记录 + 至少5条信息卡 + 每条含来源和可靠度",
            "goals": "K4(情报与信息差), S4(信息不对称分析), C2(战略思维)",
            "prerequisites": [],
            "toolType": "form",
            "image": "lessons/lesson_zhuhun_001/assets/tasks/intelligence-matrix.svg",
            "location": {
              "mode": "point",
              "legacyMode": "inherit_role",
              "name": "情报与通信史料展区",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "中国共产党历史展览馆课程动线内",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "task-3",
            "roleStageId": "task-3",
            "name": "测判断",
            "phase": "Phase 2 展陈采证",
            "modules": "A02(表单), A01(文字输入)",
            "tools": [
              {
                "id": "quiz",
                "module": "A02",
                "name": "答题评测",
                "icon": "list-checks",
                "output": "answers",
                "config": {
                  "type": "open_response",
                  "question": "",
                  "options": []
                }
              },
              {
                "id": "text",
                "module": "A01",
                "name": "文字表单",
                "icon": "notebook-pen",
                "output": "fields",
                "config": {
                  "fields": [
                    {
                      "id": "observation",
                      "label": "观察记录",
                      "type": "long_text",
                      "required": true
                    }
                  ]
                }
              }
            ],
            "requirement": "选择一个行动信号，预测敌方看到它后最可能形成的两种判断；填写判断依据、我方可利用的窗口和判断失败风险",
            "guidanceSteps": [
              "从当前开放的三类信号中选择一类，作为本轮判断测试对象",
              "连续运行两轮，分别测试“敌方相信信号”和“敌方怀疑或未按预期行动”两种分支",
              "分别写出两种判断的依据，再记录可利用窗口、失败风险和使判断失效的新信息"
            ],
            "steps": [
              {
                "id": "intel-select-signal",
                "title": "选择行动信号",
                "objective": "选定一个可能被敌方观察、且适合进行多分支分析的信号",
                "studentAction": "从当前开放的三类信号中选择一类，作为本轮判断测试对象",
                "completionMode": "tool_result",
                "evidenceRequirement": "完成选择，并能在下一步说明该信号通过什么渠道可能被观察",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A02(单选答题)",
                "next": "step:intel-run-branches",
                "tools": [
                  {
                    "id": "quiz",
                    "module": "A02",
                    "name": "答题评测",
                    "icon": "list-checks",
                    "output": "answers",
                    "config": {
                      "type": "single_choice",
                      "question": "选择一个准备测试的行动信号：",
                      "options": [
                        "公开可观察的行军方向",
                        "渡口附近出现的行动迹象",
                        "可能被截获或转述的通信线索"
                      ]
                    }
                  }
                ]
              },
              {
                "id": "intel-run-branches",
                "title": "运行判断分支",
                "objective": "比较同一行动信号可能引发的不同敌方反应",
                "studentAction": "连续运行两轮，分别测试“敌方相信信号”和“敌方怀疑或未按预期行动”两种分支",
                "completionMode": "tool_result",
                "evidenceRequirement": "完成2轮且选择不同反应；运行记录保留每轮判断及公开反馈，模拟结果不得作为史实证据",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A04(沙盘推演)",
                "next": "step:intel-record-window-risk",
                "tools": [
                  {
                    "id": "simulation",
                    "module": "A04",
                    "name": "沙盘推演",
                    "icon": "waves",
                    "output": "rounds",
                    "config": {
                      "rounds": 2,
                      "resources": {
                        "证据卡": 5,
                        "时间窗口": "待判断"
                      },
                      "choices": [
                        {
                          "id": "believe",
                          "label": "敌方相信信号并调整部署",
                          "publicFeedback": "可能形成短暂窗口；需要继续检查信号能否被观察和窗口持续多久。",
                          "effects": {
                            "window": 2,
                            "exposure": 1
                          }
                        },
                        {
                          "id": "doubt",
                          "label": "敌方怀疑信号并保留兵力",
                          "publicFeedback": "窗口可能缩小；需要准备替代方案并寻找新情报。",
                          "effects": {
                            "window": -1,
                            "exposure": 1
                          }
                        },
                        {
                          "id": "other",
                          "label": "敌方形成另一种解释",
                          "publicFeedback": "原有预测失效；请说明还可能出现什么解释。",
                          "effects": {
                            "window": 0,
                            "uncertainty": 2
                          }
                        }
                      ],
                      "metrics": [
                        {
                          "id": "window",
                          "label": "可利用窗口",
                          "initial": 0,
                          "initialLabel": "待判断"
                        },
                        {
                          "id": "uncertainty",
                          "label": "不确定性",
                          "initial": 0,
                          "initialLabel": "待判断"
                        },
                        {
                          "id": "exposure",
                          "label": "信号暴露",
                          "initial": 0,
                          "initialLabel": "待判断"
                        }
                      ],
                      "allowRepeat": false,
                      "prompt": "运行两个不同的敌方反应分支，比较窗口和不确定性。",
                      "roundPrompts": [
                        "第1轮：选择敌方对信号的一种初始判断。",
                        "第2轮：改选另一种反应，检查原判断失效时会发生什么。"
                      ]
                    }
                  }
                ]
              },
              {
                "id": "intel-record-window-risk",
                "title": "记录窗口与风险",
                "objective": "为两个敌方判断分支补足依据、利用窗口和失效条件",
                "studentAction": "分别写出两种判断的依据，再记录可利用窗口、失败风险和使判断失效的新信息",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "判断A和判断B各有至少1条依据；窗口、失败风险和失效信息均完成；表述使用“可能、如果、在……条件下”",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字表单)",
                "next": "role-stage:complete",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "basis-a",
                          "label": "判断A及依据",
                          "type": "long_text",
                          "required": true,
                          "placeholder": "如果敌方相信……依据是……"
                        },
                        {
                          "id": "basis-b",
                          "label": "判断B及依据",
                          "type": "long_text",
                          "required": true,
                          "placeholder": "如果敌方怀疑或另作判断……依据是……"
                        },
                        {
                          "id": "window",
                          "label": "我方可能利用的窗口",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "risk",
                          "label": "判断失败风险",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "invalidate",
                          "label": "哪条新信息会使判断失效",
                          "type": "short_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "提交2种敌方判断 + 每种至少1条依据 + 1项利用窗口 + 1项失败风险",
            "passCondition": "提交2种敌方判断 + 每种至少1条依据 + 1项利用窗口 + 1项失败风险",
            "goals": "K4(情报与信息差), K6(虚实行动链), S5(决策矩阵), C2(战略思维)",
            "prerequisites": [],
            "toolType": "form",
            "image": "lessons/lesson_zhuhun_001/assets/tasks/intelligence-matrix.svg",
            "location": {
              "mode": "point",
              "legacyMode": "inherit_role",
              "name": "情报与通信史料展区",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "中国共产党历史展览馆课程动线内",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_zhuhun_001/assets/roles/role-card-intelligence-strategist.png",
        "badgeImage": "lessons/lesson_zhuhun_001/assets/roles/badge-intelligence-strategist.png"
      },
      {
        "id": "decision-strategist",
        "order": 3,
        "name": "决策参谋",
        "question": "多数人支持一个方案时，怎样保护有证据的不同意见并共同承担决定？",
        "selectionDescription": "负责还原方案分歧，比较收益、风险、信息可靠度和可逆性，记录决定如何形成与修正。",
        "location": "遵义会议与苟坝会议专题展陈区",
        "geofence": "中国共产党历史展览馆课程动线内",
        "type": "核心角色",
        "collectionItem": "决策层",
        "collectionItemImage": "lessons/lesson_zhuhun_001/assets/tokens/layer-decision.png",
        "tasks": [
          {
            "id": "task-1",
            "roleStageId": "task-1",
            "name": "列方案",
            "phase": "Phase 2 展陈采证",
            "modules": "A01(拍照采集), A02(表单)",
            "tools": [
              {
                "id": "photo",
                "module": "A01",
                "name": "拍照采集",
                "icon": "camera",
                "output": "files",
                "config": {
                  "minCount": 1,
                  "maxCount": 6,
                  "accept": "image/*",
                  "recognition": "course-evidence"
                }
              },
              {
                "id": "quiz",
                "module": "A02",
                "name": "答题评测",
                "icon": "list-checks",
                "output": "answers",
                "config": {
                  "type": "open_response",
                  "question": "",
                  "options": []
                }
              }
            ],
            "requirement": "拍摄至少1处允许拍摄的会议相关展项说明；从材料中提取2个待比较方案或意见，记录提出背景、支持理由、反对理由和材料来源",
            "guidanceSteps": [
              "拍摄一张会议相关展项及其说明牌，确保方案背景或讨论对象可以辨认",
              "分别填写方案A和方案B的背景、主张及材料来源；材料没有说明的内容写“未知”",
              "选择最适合进入下一阶段风险比较的记录方式"
            ],
            "steps": [
              {
                "id": "decision-capture-source",
                "title": "拍下方案来源",
                "objective": "获得能够追溯会议背景和不同意见的现场材料",
                "studentAction": "拍摄一张会议相关展项及其说明牌，确保方案背景或讨论对象可以辨认",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少1张有效照片，同时保留展项主体和标题或说明；不得拍入其他参观者正脸",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(拍照)",
                "next": "step:decision-build-options",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 1,
                      "maxCount": 3,
                      "accept": "image/*",
                      "recognition": "meeting-options-source",
                      "prompt": "把会议展项与说明牌一起拍下，优先保留讨论背景和材料来源。"
                    }
                  }
                ]
              },
              {
                "id": "decision-build-options",
                "title": "建立两个方案条目",
                "objective": "忠实整理材料中出现的两个待比较方案或意见",
                "studentAction": "分别填写方案A和方案B的背景、主张及材料来源；材料没有说明的内容写“未知”",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "两个方案均包含名称或中性转述、提出背景和来源；不使用没有可靠出处的直接引语",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字表单)",
                "next": "step:decision-balance-reasons",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "option-a",
                          "label": "方案A：中性转述",
                          "type": "long_text",
                          "required": true,
                          "placeholder": "材料中明确出现的意见；不要添加人物原话"
                        },
                        {
                          "id": "context-a",
                          "label": "方案A：提出背景",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "source-a",
                          "label": "方案A：来源",
                          "type": "short_text",
                          "required": true,
                          "placeholder": "展项标题或照片编号"
                        },
                        {
                          "id": "option-b",
                          "label": "方案B：中性转述",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "context-b",
                          "label": "方案B：提出背景",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "source-b",
                          "label": "方案B：来源",
                          "type": "short_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "decision-balance-reasons",
                "title": "检查正反理由",
                "objective": "理解比较方案时需要同时保存支持和反对理由",
                "studentAction": "选择最适合进入下一阶段风险比较的记录方式",
                "completionMode": "tool_result",
                "evidenceRequirement": "正确选择同时记录两个方案的支持理由、反对理由和来源的做法",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A02(单选答题)",
                "next": "role-stage:task-2",
                "tools": [
                  {
                    "id": "quiz",
                    "module": "A02",
                    "name": "答题评测",
                    "icon": "list-checks",
                    "output": "answers",
                    "config": {
                      "type": "single_choice",
                      "question": "怎样整理两个方案，才能进入公平的风险比较？",
                      "options": [
                        "只记录多数人支持方案的优点",
                        "给每个方案分别记录支持理由、反对理由和材料来源",
                        "先看后来结果，再删除失败方案的合理理由"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "至少1张来源照片 + 2个方案条目 + 每个方案含支持与反对理由",
            "passCondition": "至少1张来源照片 + 2个方案条目 + 每个方案含支持与反对理由",
            "goals": "K5(遵义与苟坝), S3(史料实证), S5(决策矩阵)",
            "prerequisites": [],
            "toolType": "capture",
            "image": "lessons/lesson_zhuhun_001/assets/tasks/decision-matrix.svg",
            "location": {
              "mode": "point",
              "legacyMode": "inherit_role",
              "name": "遵义会议与苟坝会议专题展陈区",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "中国共产党历史展览馆课程动线内",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "task-2",
            "roleStageId": "task-2",
            "name": "比风险",
            "phase": "Phase 2 展陈采证",
            "modules": "A04(沙盘推演), A02(表单)",
            "tools": [
              {
                "id": "simulation",
                "module": "A04",
                "name": "沙盘推演",
                "icon": "waves",
                "output": "rounds",
                "config": {
                  "rounds": 1,
                  "resources": {},
                  "choices": [],
                  "metrics": []
                }
              },
              {
                "id": "quiz",
                "module": "A02",
                "name": "答题评测",
                "icon": "list-checks",
                "output": "answers",
                "config": {
                  "type": "open_response",
                  "question": "",
                  "options": []
                }
              }
            ],
            "requirement": "为每个方案评估目标一致度、证据可靠度、成功收益、失败代价和可逆性；保留至少1条少数意见并写明复核办法",
            "guidanceSteps": [
              "分别为方案A、方案B填写目标一致度、证据可靠度、成功收益、失败代价和可逆性，并给出一句评分依据",
              "运行两轮风险测试：一轮假设敌情判断错误，一轮假设行动窗口已经变化",
              "组内讨论后至少记录两条内容：阶段选择与理由、少数意见及其复核条件"
            ],
            "steps": [
              {
                "id": "decision-score-options",
                "title": "完成五维比较",
                "objective": "用同一套维度比较两个方案的收益、风险和信息质量",
                "studentAction": "分别为方案A、方案B填写目标一致度、证据可靠度、成功收益、失败代价和可逆性，并给出一句评分依据",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "两个方案的五个维度均完成；每个方案至少引用1条任务1材料；分数或高低判断附带理由",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字表单)",
                "next": "step:decision-test-failure",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "a-goal",
                          "label": "方案A｜目标一致度及依据",
                          "type": "short_text",
                          "required": true,
                          "placeholder": "高/中/低 + 依据"
                        },
                        {
                          "id": "a-reliability",
                          "label": "方案A｜证据可靠度及依据",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "a-benefit",
                          "label": "方案A｜成功收益",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "a-cost",
                          "label": "方案A｜失败代价",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "a-reversible",
                          "label": "方案A｜可逆性",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "b-goal",
                          "label": "方案B｜目标一致度及依据",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "b-reliability",
                          "label": "方案B｜证据可靠度及依据",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "b-benefit",
                          "label": "方案B｜成功收益",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "b-cost",
                          "label": "方案B｜失败代价",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "b-reversible",
                          "label": "方案B｜可逆性",
                          "type": "short_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "decision-test-failure",
                "title": "测试错误前提",
                "objective": "检验关键判断出错时两个方案的失败代价和调整空间",
                "studentAction": "运行两轮风险测试：一轮假设敌情判断错误，一轮假设行动窗口已经变化",
                "completionMode": "tool_result",
                "evidenceRequirement": "完成2轮不同风险测试；每轮选择一个应对方案，保留失败代价和是否还能调整的记录",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A04(沙盘推演)",
                "next": "step:decision-record-team-decision",
                "tools": [
                  {
                    "id": "simulation",
                    "module": "A04",
                    "name": "沙盘推演",
                    "icon": "waves",
                    "output": "rounds",
                    "config": {
                      "rounds": 2,
                      "resources": {
                        "候选方案": 2,
                        "复核机会": 1
                      },
                      "choices": [
                        {
                          "id": "continue-a",
                          "label": "继续方案A并设置复核点",
                          "publicFeedback": "请检查复核点出现前的失败代价是否能够承受。",
                          "effects": {
                            "risk": 1,
                            "reversible": 1
                          }
                        },
                        {
                          "id": "continue-b",
                          "label": "继续方案B并设置退出条件",
                          "publicFeedback": "请检查退出条件是否清楚，以及何时重新讨论。",
                          "effects": {
                            "risk": 1,
                            "reversible": 2
                          }
                        },
                        {
                          "id": "pause-review",
                          "label": "暂缓决定，先补充关键证据",
                          "publicFeedback": "补证据会消耗窗口；请比较延误风险与错误行动风险。",
                          "effects": {
                            "time": -1,
                            "reliability": 2
                          }
                        }
                      ],
                      "metrics": [
                        {
                          "id": "risk",
                          "label": "失败代价",
                          "initial": 0,
                          "initialLabel": "待评估"
                        },
                        {
                          "id": "reversible",
                          "label": "调整空间",
                          "initial": 0,
                          "initialLabel": "待评估"
                        },
                        {
                          "id": "time",
                          "label": "时间变化",
                          "initial": 0,
                          "initialLabel": "待评估"
                        },
                        {
                          "id": "reliability",
                          "label": "证据可靠度",
                          "initial": 0,
                          "initialLabel": "待评估"
                        }
                      ],
                      "allowRepeat": false,
                      "prompt": "用两个不同方案检验失败代价、调整空间和证据可靠度。",
                      "roundPrompts": [
                        "第1轮：假设一项敌情判断有误，选择应对方式。",
                        "第2轮：假设行动窗口缩短，改选另一方案继续检验。"
                      ]
                    }
                  }
                ]
              },
              {
                "id": "decision-record-team-decision",
                "title": "记录小组决定与异议",
                "objective": "形成可执行的阶段选择，同时保护有证据的少数意见",
                "studentAction": "组内讨论后至少记录两条内容：阶段选择与理由、少数意见及其复核条件",
                "completionMode": "tool_result",
                "evidenceRequirement": "至少2条组内记录；一条明确小组阶段选择和依据，一条保留不同意见、核验办法或重新讨论触发点",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A05(团队投票与异议记录)",
                "next": "role-stage:task-3",
                "tools": [
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "vote",
                      "prompt": "先记录小组选择及证据，再单独记录少数意见、复核办法和重新讨论条件；不要把课程投票写成历史事实。",
                      "minimumEntries": 3,
                      "roles": [
                        "记录人",
                        "复核人",
                        "风险提醒人"
                      ],
                      "recordTypes": [
                        "小组选择与证据",
                        "少数意见",
                        "复核或重议条件"
                      ],
                      "requiredRecordTypes": [
                        "小组选择与证据",
                        "少数意见",
                        "复核或重议条件"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "完成2个方案的五维比较 + 1条少数意见保护机制 + 小组提交阶段选择",
            "passCondition": "完成2个方案的五维比较 + 1条少数意见保护机制 + 小组提交阶段选择",
            "goals": "K5(遵义与苟坝), S5(决策矩阵), C1(实事求是), C4(民主与担当)",
            "prerequisites": [],
            "toolType": "simulation",
            "image": "lessons/lesson_zhuhun_001/assets/tasks/decision-matrix.svg",
            "location": {
              "mode": "point",
              "legacyMode": "inherit_role",
              "name": "遵义会议与苟坝会议专题展陈区",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "中国共产党历史展览馆课程动线内",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "task-3",
            "roleStageId": "task-3",
            "name": "复决策",
            "phase": "Phase 2 展陈采证",
            "modules": "A01(文字输入), A02(反思表单)",
            "tools": [
              {
                "id": "text",
                "module": "A01",
                "name": "文字表单",
                "icon": "notebook-pen",
                "output": "fields",
                "config": {
                  "fields": [
                    {
                      "id": "observation",
                      "label": "观察记录",
                      "type": "long_text",
                      "required": true
                    }
                  ]
                }
              },
              {
                "id": "quiz",
                "module": "A02",
                "name": "答题评测",
                "icon": "list-checks",
                "output": "answers",
                "config": {
                  "type": "open_response",
                  "question": "",
                  "options": []
                }
              }
            ],
            "requirement": "阅读本轮开放的课程复核材料后，写出原方案保留、修改或放弃的部分；用“新证据—判断变化—责任安排”完成复盘",
            "guidanceSteps": [
              "完整查看本轮开放的课程复核卡，找出一条能够改变原判断的新信息",
              "把原判断、新证据、保留内容、修改内容、放弃内容和行动责任卡放入对应区域",
              "用“新证据—判断变化—责任安排”完成三段式复盘，并引用至少2条证据"
            ],
            "steps": [
              {
                "id": "decision-read-new-evidence",
                "title": "读取新增材料",
                "objective": "在任务2完成后获得用于复盘的新增课程推演材料",
                "studentAction": "完整查看本轮开放的课程复核卡，找出一条能够改变原判断的新信息",
                "completionMode": "tool_result",
                "evidenceRequirement": "完成材料查看；明确区分“课程推演信息”和“历史知识”，不把课程情境改写成历史人物直接引语",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A06(沉浸媒体)",
                "next": "step:decision-compare-version",
                "tools": [
                  {
                    "id": "media",
                    "module": "A06",
                    "name": "沉浸媒体",
                    "icon": "play",
                    "output": "playback",
                    "config": {
                      "type": "image",
                      "url": "lessons/lesson_zhuhun_001/assets/tasks/decision-review-card.svg",
                      "poster": "",
                      "title": "本轮新增课程材料｜复核与决策机制",
                      "requireCompletion": true,
                      "prompt": "材料在任务2完成后开放。阅读时寻找改变原方案前提的新信息，并保留课程推演标识。"
                    }
                  }
                ]
              },
              {
                "id": "decision-compare-version",
                "title": "整理判断变化",
                "objective": "保留原方案痕迹并区分保留、修改和放弃的内容",
                "studentAction": "把原判断、新证据、保留内容、修改内容、放弃内容和行动责任卡放入对应区域",
                "completionMode": "tool_result",
                "evidenceRequirement": "6张卡全部进入作品区；原判断不得删除，新证据与至少一项修改或放弃建立对应关系",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(版本对照搭建)",
                "next": "step:decision-write-revision",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "flow",
                      "items": [
                        {
                          "id": "original",
                          "label": "任务2·原阶段选择"
                        },
                        {
                          "id": "new-evidence",
                          "label": "新增课程材料中的关键信息"
                        },
                        {
                          "id": "keep",
                          "label": "仍然保留的判断"
                        },
                        {
                          "id": "change",
                          "label": "需要修改的判断"
                        },
                        {
                          "id": "drop",
                          "label": "需要放弃的判断"
                        },
                        {
                          "id": "responsibility",
                          "label": "统一行动与责任安排"
                        }
                      ],
                      "zones": [
                        {
                          "id": "before",
                          "label": "原判断"
                        },
                        {
                          "id": "trigger",
                          "label": "新信息"
                        },
                        {
                          "id": "after",
                          "label": "保留/修改/放弃"
                        },
                        {
                          "id": "action",
                          "label": "统一行动"
                        }
                      ],
                      "connections": [],
                      "prompt": "保留原判断，再按新信息整理保留、修改、放弃和责任安排。",
                      "bindings": {
                        "original": {
                          "taskId": "task-2",
                          "stepId": "decision-record-team-decision",
                          "toolId": "team",
                          "property": "entries",
                          "prefix": "原讨论："
                        }
                      }
                    }
                  }
                ]
              },
              {
                "id": "decision-write-revision",
                "title": "完成决策复盘",
                "objective": "用证据说明判断为什么改变，以及决定后怎样共同承担行动",
                "studentAction": "用“新证据—判断变化—责任安排”完成三段式复盘，并引用至少2条证据",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "三个字段完整；至少引用任务1现场材料和任务3新增材料各1条；明确一项统一行动安排，不把课程投票写成历史会议事实",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字表单)",
                "next": "role-stage:complete",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "new-evidence",
                          "label": "新证据及来源",
                          "type": "long_text",
                          "required": true,
                          "placeholder": "至少引用两条不同阶段证据"
                        },
                        {
                          "id": "change",
                          "label": "判断变化",
                          "type": "long_text",
                          "required": true,
                          "placeholder": "原来认为……现在保留/修改/放弃……因为……"
                        },
                        {
                          "id": "responsibility",
                          "label": "统一行动与责任安排",
                          "type": "long_text",
                          "required": true,
                          "placeholder": "决定形成后，谁核验、谁执行、何时复盘"
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "三段式复盘完整 + 引用至少2条证据 + 明确1项统一行动安排",
            "passCondition": "三段式复盘完整 + 引用至少2条证据 + 明确1项统一行动安排",
            "goals": "K5(遵义与苟坝), S6(因果表达), C1(实事求是), C4(民主与担当)",
            "prerequisites": [],
            "toolType": "text",
            "image": "lessons/lesson_zhuhun_001/assets/tasks/decision-matrix.svg",
            "location": {
              "mode": "point",
              "legacyMode": "inherit_role",
              "name": "遵义会议与苟坝会议专题展陈区",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "中国共产党历史展览馆课程动线内",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_zhuhun_001/assets/roles/role-card-decision-strategist.png",
        "badgeImage": "lessons/lesson_zhuhun_001/assets/roles/badge-decision-strategist.png"
      },
      {
        "id": "feint-strategist",
        "order": 4,
        "name": "示形参谋",
        "question": "怎样用可被敌方观察到的行动改变其部署，同时为真正目标创造窗口？",
        "selectionDescription": "负责拆解行动顺序和虚实关系，推演我方信号、敌方判断与兵力调动之间的连锁反应。",
        "location": "四渡赤水战术部署展区",
        "geofence": "中国共产党历史展览馆课程动线内",
        "type": "核心角色",
        "collectionItem": "行动层",
        "collectionItemImage": "lessons/lesson_zhuhun_001/assets/tokens/layer-action.png",
        "tasks": [
          {
            "id": "task-1",
            "roleStageId": "task-1",
            "name": "排行动",
            "phase": "Phase 2 展陈采证",
            "modules": "A01(拍照采集), A02(排序答题)",
            "tools": [
              {
                "id": "photo",
                "module": "A01",
                "name": "拍照采集",
                "icon": "camera",
                "output": "files",
                "config": {
                  "minCount": 1,
                  "maxCount": 6,
                  "accept": "image/*",
                  "recognition": "course-evidence"
                }
              },
              {
                "id": "quiz",
                "module": "A02",
                "name": "答题评测",
                "icon": "list-checks",
                "output": "answers",
                "config": {
                  "type": "ordering",
                  "question": "",
                  "options": []
                }
              }
            ],
            "requirement": "寻找四渡赤水战术部署展项，拍摄至少1处允许拍摄的展项说明；提取4张行动卡，按时间顺序排列，并给每张卡标注地点、可见信号和材料来源",
            "guidanceSteps": [
              "拍摄一张战术部署展项全景和一张包含日期、先后词或图例的局部照片",
              "根据现场材料排列四张行动逻辑卡，并为每一处相邻关系指出一条日期、先后词、地点或图例依据",
              "为四张行动逻辑卡分别填写现场线索，并标明照片编号或展项标题"
            ],
            "steps": [
              {
                "id": "feint-capture-deployment",
                "title": "采集部署展项",
                "objective": "获得可以支持行动顺序判断的现场展项来源",
                "studentAction": "拍摄一张战术部署展项全景和一张包含日期、先后词或图例的局部照片",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少2张照片；全景能够确认展项，局部至少呈现日期、先后词、地点或图例中的一项；不得拍摄未允许区域",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(拍照)",
                "next": "step:feint-order-actions",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 2,
                      "maxCount": 4,
                      "accept": "image/*",
                      "recognition": "deployment-sequence-source",
                      "prompt": "先拍展项全景，再拍能够支持先后顺序的日期、文字或图例局部。"
                    }
                  }
                ]
              },
              {
                "id": "feint-order-actions",
                "title": "排列行动逻辑",
                "objective": "在不提前打开完整史实路线的前提下建立行动影响的先后链",
                "studentAction": "根据现场材料排列四张行动逻辑卡，并为每一处相邻关系指出一条日期、先后词、地点或图例依据",
                "completionMode": "tool_result",
                "evidenceRequirement": "四张卡形成一条可解释的因果顺序；排序依据来自任务照片或展项先后词，不补写尚未解锁的渡口和完整路线",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A02(排序答题)",
                "next": "step:feint-source-action-cards",
                "tools": [
                  {
                    "id": "quiz",
                    "module": "A02",
                    "name": "答题评测",
                    "icon": "list-checks",
                    "output": "answers",
                    "config": {
                      "type": "ordering",
                      "question": "根据现场材料，排列一条行动产生战略窗口的基本逻辑。",
                      "options": [
                        "敌方根据可见信号调整部署",
                        "原计划遇到新的现实约束",
                        "我方获得重新选择方向的窗口",
                        "我方采取可被观察的阶段行动"
                      ]
                    }
                  }
                ]
              },
              {
                "id": "feint-source-action-cards",
                "title": "补齐行动卡依据",
                "objective": "让行动链中的每一环都带有地点、可见信号或材料来源",
                "studentAction": "为四张行动逻辑卡分别填写现场线索，并标明照片编号或展项标题",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "四张卡均有来源；至少两张卡写出地点或可见信号；无法确认的行动细节明确标“待核”。",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字表单)",
                "next": "role-stage:task-2",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "constraint-source",
                          "label": "现实约束卡｜现场线索与来源",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "action-source",
                          "label": "可见行动卡｜地点或信号与来源",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "reaction-source",
                          "label": "敌方反应卡｜材料依据或待核说明",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "window-source",
                          "label": "新窗口卡｜材料依据或待核说明",
                          "type": "long_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "至少1张展项来源照片 + 4张行动卡 + 顺序、地点和来源完整",
            "passCondition": "至少1张展项来源照片 + 4张行动卡 + 顺序、地点和来源完整",
            "goals": "K3(四次渡河), S3(史料实证), S6(因果表达)",
            "prerequisites": [],
            "toolType": "capture",
            "image": "lessons/lesson_zhuhun_001/assets/tasks/feint-route.svg",
            "location": {
              "mode": "point",
              "legacyMode": "inherit_role",
              "name": "四渡赤水战术部署展区",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "中国共产党历史展览馆课程动线内",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "task-2",
            "roleStageId": "task-2",
            "name": "辨虚实",
            "phase": "Phase 2 展陈采证",
            "modules": "A01(画板标注), A02(表单)",
            "tools": [
              {
                "id": "sketch",
                "module": "A01",
                "name": "画板标注",
                "icon": "pen-tool",
                "output": "image",
                "config": {
                  "width": 720,
                  "height": 420,
                  "brushColors": [
                    "#8d211f",
                    "#245c4f",
                    "#1f2937"
                  ],
                  "backgroundImage": ""
                }
              },
              {
                "id": "quiz",
                "module": "A02",
                "name": "答题评测",
                "icon": "list-checks",
                "output": "answers",
                "config": {
                  "type": "open_response",
                  "question": "",
                  "options": []
                }
              }
            ],
            "requirement": "选取相邻两次行动，分别标注“敌方能看到什么、敌方可能怎么判断、我方真正需要什么”；至少提出1种其他解释",
            "guidanceSteps": [
              "把四张关系卡分别放入“看见什么、可能怎么判断、我方需要什么、其他解释”四栏",
              "根据同一行动信号，分别写出敌方可能相信的解释、另一种解释和两种解释各自需要的证据",
              "选择一组能够支持“示形可能产生作用”的最低条件"
            ],
            "steps": [
              {
                "id": "feint-build-signal-chain",
                "title": "搭建信号链",
                "objective": "区分可见信号、敌方判断、我方需要和替代解释",
                "studentAction": "把四张关系卡分别放入“看见什么、可能怎么判断、我方需要什么、其他解释”四栏",
                "completionMode": "tool_result",
                "evidenceRequirement": "四张卡全部完成分类；“敌方判断”保持可能性表述，“其他解释”不得与原判断完全相同",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(分类搭建)",
                "next": "step:feint-add-alternative",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "flow",
                      "items": [
                        {
                          "id": "visible",
                          "label": "任务1·可被观察的行动信号"
                        },
                        {
                          "id": "enemy-judgment",
                          "label": "敌方可能形成的判断"
                        },
                        {
                          "id": "our-need",
                          "label": "我方希望获得的时间或空间窗口"
                        },
                        {
                          "id": "alternative",
                          "label": "同一信号的另一种解释"
                        }
                      ],
                      "zones": [
                        {
                          "id": "seen",
                          "label": "敌方看见什么"
                        },
                        {
                          "id": "judge",
                          "label": "敌方可能怎么判断"
                        },
                        {
                          "id": "need",
                          "label": "我方真正需要什么"
                        },
                        {
                          "id": "other",
                          "label": "替代解释"
                        }
                      ],
                      "connections": [],
                      "prompt": "把同一组行动线索拆成四栏，先区分信号和解释，再讨论真正需要。",
                      "bindings": {
                        "visible": {
                          "taskId": "task-1",
                          "stepId": "feint-source-action-cards",
                          "toolId": "text",
                          "fieldId": "action-source",
                          "prefix": "行动信号："
                        }
                      }
                    }
                  }
                ]
              },
              {
                "id": "feint-add-alternative",
                "title": "写出替代解释",
                "objective": "避免把敌方反应固定为单一路径",
                "studentAction": "根据同一行动信号，分别写出敌方可能相信的解释、另一种解释和两种解释各自需要的证据",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "两种解释不同；每种解释至少附1条当前证据或待核条件；使用“可能、如果”表述",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字表单)",
                "next": "step:feint-check-evidence",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "interpretation-a",
                          "label": "解释A：敌方可能相信什么",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "evidence-a",
                          "label": "解释A：依据或成立条件",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "interpretation-b",
                          "label": "解释B：另一种可能",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "evidence-b",
                          "label": "解释B：依据或待核条件",
                          "type": "long_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "feint-check-evidence",
                "title": "检查虚实判断依据",
                "objective": "确认虚实判断需要信号、观察条件和敌方既有判断共同支持",
                "studentAction": "选择一组能够支持“示形可能产生作用”的最低条件",
                "completionMode": "tool_result",
                "evidenceRequirement": "正确识别信号可见、符合敌方已有判断、调动留下窗口三项条件",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A02(多选答题)",
                "next": "role-stage:task-3",
                "tools": [
                  {
                    "id": "quiz",
                    "module": "A02",
                    "name": "答题评测",
                    "icon": "list-checks",
                    "output": "answers",
                    "config": {
                      "type": "multiple_choice",
                      "question": "示形可能影响敌方判断，至少需要检查哪些条件？",
                      "options": [
                        "信号能够被敌方观察",
                        "信号符合敌方已有判断",
                        "敌方调动可能留下我方可利用窗口",
                        "行动最后成功，所以此前条件无需核验"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "完成三栏虚实图 + 1种替代解释 + 至少2条证据引用",
            "passCondition": "完成三栏虚实图 + 1种替代解释 + 至少2条证据引用",
            "goals": "K4(情报与信息差), K6(虚实行动链), S4(信息不对称分析), C2(战略思维)",
            "prerequisites": [],
            "toolType": "sketch",
            "image": "lessons/lesson_zhuhun_001/assets/tasks/feint-route.svg",
            "location": {
              "mode": "point",
              "legacyMode": "inherit_role",
              "name": "四渡赤水战术部署展区",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "中国共产党历史展览馆课程动线内",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "task-3",
            "roleStageId": "task-3",
            "name": "演反应",
            "phase": "Phase 2 展陈采证",
            "modules": "A04(沙盘推演), A05(讨论记录)",
            "tools": [
              {
                "id": "simulation",
                "module": "A04",
                "name": "沙盘推演",
                "icon": "waves",
                "output": "rounds",
                "config": {
                  "rounds": 1,
                  "resources": {},
                  "choices": [],
                  "metrics": []
                }
              },
              {
                "id": "team",
                "module": "A05",
                "name": "团队协作",
                "icon": "users",
                "output": "teamLog",
                "config": {
                  "mode": "discussion",
                  "prompt": "",
                  "minimumEntries": 1,
                  "roles": []
                }
              }
            ],
            "requirement": "在路径推演器中提交“我方行动—敌方第一反应—我方后续窗口—失败风险”行动链，并运行至少2种敌方反应",
            "guidanceSteps": [
              "运行两轮推演，分别选择“敌方相信信号”和“敌方识破或不按预期行动”",
              "与同伴至少记录两条讨论结果：一条备用方案，一条停止或调整示形的触发条件",
              "填写“我方行动—敌方第一反应—我方后续窗口—失败风险”，再写出一项使行动链失效的新信息"
            ],
            "steps": [
              {
                "id": "feint-run-reactions",
                "title": "运行敌方反应",
                "objective": "通过不同敌方反应检验行动链的稳健性",
                "studentAction": "运行两轮推演，分别选择“敌方相信信号”和“敌方识破或不按预期行动”",
                "completionMode": "tool_result",
                "evidenceRequirement": "完成2轮不同分支；每轮保留我方窗口和暴露风险反馈，模拟记录不得标为史实",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A04(沙盘推演)",
                "next": "step:feint-discuss-fallback",
                "tools": [
                  {
                    "id": "simulation",
                    "module": "A04",
                    "name": "沙盘推演",
                    "icon": "waves",
                    "output": "rounds",
                    "config": {
                      "rounds": 2,
                      "resources": {
                        "行动卡": 4,
                        "备用出口": 1
                      },
                      "choices": [
                        {
                          "id": "believe",
                          "label": "敌方相信信号并调动兵力",
                          "publicFeedback": "可能出现行动窗口；仍需判断窗口长度和信号成本。",
                          "effects": {
                            "window": 2,
                            "exposure": 1
                          }
                        },
                        {
                          "id": "detect",
                          "label": "敌方识破信号并保留部署",
                          "publicFeedback": "原窗口缩小；需要备用方案、退出条件或新情报。",
                          "effects": {
                            "window": -2,
                            "exposure": 2
                          }
                        },
                        {
                          "id": "delay",
                          "label": "敌方迟疑并延后反应",
                          "publicFeedback": "局势仍不确定；时间消耗可能同时影响双方。",
                          "effects": {
                            "window": 0,
                            "time": -1
                          }
                        }
                      ],
                      "metrics": [
                        {
                          "id": "window",
                          "label": "行动窗口",
                          "initial": 0,
                          "initialLabel": "未形成"
                        },
                        {
                          "id": "exposure",
                          "label": "暴露风险",
                          "initial": 0,
                          "initialLabel": "待判断"
                        },
                        {
                          "id": "time",
                          "label": "时间变化",
                          "initial": 0,
                          "initialLabel": "待判断"
                        }
                      ],
                      "allowRepeat": false,
                      "prompt": "运行两个不同反应分支，检查行动链在不利条件下是否仍有出口。",
                      "roundPrompts": [
                        "第1轮：选择敌方对行动信号的一种反应。",
                        "第2轮：改选另一种反应，检查备用方案和退出条件。"
                      ]
                    }
                  }
                ]
              },
              {
                "id": "feint-discuss-fallback",
                "title": "讨论备用方案",
                "objective": "形成示形失效时的退出条件和备用行动原则",
                "studentAction": "与同伴至少记录两条讨论结果：一条备用方案，一条停止或调整示形的触发条件",
                "completionMode": "tool_result",
                "evidenceRequirement": "至少2条组内记录；分别包含备用方案与退出条件，并说明依据来自哪一轮推演",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A05(团队讨论)",
                "next": "step:feint-record-robustness",
                "tools": [
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "discussion",
                      "prompt": "根据两轮运行记录，分别写下备用方案和退出条件；保留不同意见，不讨论现实冲突操作。",
                      "minimumEntries": 2,
                      "roles": [
                        "行动链说明人",
                        "风险提醒人",
                        "记录人"
                      ],
                      "recordTypes": [
                        "备用方案",
                        "退出条件",
                        "不同意见"
                      ],
                      "requiredRecordTypes": [
                        "备用方案",
                        "退出条件"
                      ]
                    }
                  }
                ]
              },
              {
                "id": "feint-record-robustness",
                "title": "归纳行动链边界",
                "objective": "形成带条件的四环行动链和风险结论",
                "studentAction": "填写“我方行动—敌方第一反应—我方后续窗口—失败风险”，再写出一项使行动链失效的新信息",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "四环完整；引用两轮模拟记录；至少包含1项失败风险和1项失效信息；不用必然性语言",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字表单)",
                "next": "role-stage:complete",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "our-action",
                          "label": "我方行动信号",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "enemy-reaction",
                          "label": "敌方可能的第一反应",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "window",
                          "label": "我方可能获得的后续窗口",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "failure-risk",
                          "label": "失败风险",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "invalidating-info",
                          "label": "使行动链失效的新信息",
                          "type": "short_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "1条四环行动链 + 2种敌方反应分支 + 1项失败风险 + 保留运行记录",
            "passCondition": "1条四环行动链 + 2种敌方反应分支 + 1项失败风险 + 保留运行记录",
            "goals": "K6(虚实行动链), S4(信息不对称分析), S5(决策矩阵), C2(战略思维)",
            "prerequisites": [],
            "toolType": "simulation",
            "image": "lessons/lesson_zhuhun_001/assets/tasks/feint-route.svg",
            "location": {
              "mode": "point",
              "legacyMode": "inherit_role",
              "name": "四渡赤水战术部署展区",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "中国共产党历史展览馆课程动线内",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_zhuhun_001/assets/roles/role-card-feint-strategist.png",
        "badgeImage": "lessons/lesson_zhuhun_001/assets/roles/badge-feint-strategist.png"
      },
      {
        "id": "signaler",
        "order": 5,
        "name": "通讯兵",
        "question": "只收到局部命令、看不到全局时，一个人依据什么确认信息并可靠行动？",
        "selectionDescription": "负责从基层视角检查命令如何传递、确认和执行，记录全局战略在个人信息中留下的有限线索。",
        "location": "亲历者回忆与士兵生活展区",
        "geofence": "中国共产党历史展览馆课程动线内",
        "type": "核心角色",
        "collectionItem": "视角层",
        "collectionItemImage": "lessons/lesson_zhuhun_001/assets/tokens/layer-perspective.png",
        "tasks": [
          {
            "id": "task-1",
            "roleStageId": "task-1",
            "name": "收残讯",
            "phase": "Phase 2 展陈采证",
            "modules": "A01(拍照采集/语音), A07(扫码)",
            "tools": [
              {
                "id": "photo",
                "module": "A01",
                "name": "拍照采集",
                "icon": "camera",
                "output": "files",
                "config": {
                  "minCount": 1,
                  "maxCount": 6,
                  "accept": "image/*",
                  "recognition": "course-evidence"
                }
              },
              {
                "id": "audio",
                "module": "A01",
                "name": "语音记录",
                "icon": "mic",
                "output": "recording",
                "config": {
                  "minSeconds": 3,
                  "maxSeconds": 90,
                  "language": "zh-CN",
                  "transcribe": true
                }
              },
              {
                "id": "scanner",
                "module": "A07",
                "name": "扫码识别",
                "icon": "scan-line",
                "output": "scanResult",
                "config": {
                  "mode": "qr",
                  "allowManualEntry": true,
                  "prompt": ""
                }
              }
            ],
            "requirement": "寻找通信工具、口述回忆或士兵生活相关展项，拍摄至少2处允许拍摄的证据；记录一名基层行动者可能收到的信息和仍然不知道的信息",
            "guidanceSteps": [
              "拍摄一张通信工具、口述回忆或士兵生活展项全景，再拍一张对应说明牌局部",
              "把6张信息卡放入“基层可以确认、需要再次确认、当时无法知道”三个区域",
              "选择一组符合史料边界的基层信息记录"
            ],
            "steps": [
              {
                "id": "signal-capture-evidence",
                "title": "采集基层通信证据",
                "objective": "获得能够说明基层信息如何传递的物件或回忆材料证据",
                "studentAction": "拍摄一张通信工具、口述回忆或士兵生活展项全景，再拍一张对应说明牌局部",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "至少2张照片；全景能够确认展项类型，局部保留标题、用途、回忆来源或时间中的至少一项；不识别其他参观者身份",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(拍照)",
                "next": "step:signal-sort-known-unknown",
                "tools": [
                  {
                    "id": "photo",
                    "module": "A01",
                    "name": "拍照采集",
                    "icon": "camera",
                    "output": "files",
                    "config": {
                      "minCount": 2,
                      "maxCount": 4,
                      "accept": "image/*",
                      "recognition": "grassroots-communication-source",
                      "prompt": "先拍展项全景，再拍说明文字；照片用于判断基层能收到什么信息和还不知道什么。"
                    }
                  }
                ]
              },
              {
                "id": "signal-sort-known-unknown",
                "title": "区分已知与未知",
                "objective": "从基层视角区分执行当前行动所需信息和无法获得的全局信息",
                "studentAction": "把6张信息卡放入“基层可以确认、需要再次确认、当时无法知道”三个区域",
                "completionMode": "tool_result",
                "evidenceRequirement": "6张卡全部分类；“基层可以确认”和“当时无法知道”各至少2张；不能用全局战图替基层补信息",
                "location": {
                  "mode": "inherit",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(分类搭建)",
                "next": "step:signal-mark-evidence-boundary",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "evidence-wall",
                      "items": [
                        {
                          "id": "current-action",
                          "label": "当前需要完成的动作"
                        },
                        {
                          "id": "time-place",
                          "label": "命令中明确的时间或地点"
                        },
                        {
                          "id": "confirm-person",
                          "label": "可以确认信息的对象"
                        },
                        {
                          "id": "global-purpose",
                          "label": "行动的完整战略目的"
                        },
                        {
                          "id": "whole-route",
                          "label": "后续全部路线"
                        },
                        {
                          "id": "enemy-full-plan",
                          "label": "敌方完整部署与真实意图"
                        }
                      ],
                      "zones": [
                        {
                          "id": "known",
                          "label": "基层可以确认"
                        },
                        {
                          "id": "needs-confirmation",
                          "label": "需要再次确认"
                        },
                        {
                          "id": "unknown",
                          "label": "当时无法知道"
                        }
                      ],
                      "connections": [],
                      "prompt": "站在基层行动者当时的位置分类：哪些能直接确认，哪些要向上级核对，哪些属于全局信息。"
                    }
                  }
                ]
              },
              {
                "id": "signal-mark-evidence-boundary",
                "title": "检查叙述边界",
                "objective": "用可追溯语言描述基层视角，同时保留推断和未知",
                "studentAction": "选择一组符合史料边界的基层信息记录",
                "completionMode": "tool_result",
                "evidenceRequirement": "正确选择同时区分材料明确说明、合理推测和无法确认的表达",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A02(单选答题)",
                "next": "role-stage:task-2",
                "tools": [
                  {
                    "id": "quiz",
                    "module": "A02",
                    "name": "答题评测",
                    "icon": "list-checks",
                    "output": "answers",
                    "config": {
                      "type": "single_choice",
                      "question": "根据一件通信工具展项，哪种记录最符合证据边界？",
                      "options": [
                        "这名士兵一定知道全局计划，也完全理解每次转向原因",
                        "展项说明这种工具用于传递信息；基层能收到什么需结合具体命令，其他内容暂时未知",
                        "请AI补写一段士兵当时说过的话，让记录更生动"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "至少2张有效照片 + 1条展项来源 + “已知/未知”各至少2项",
            "passCondition": "至少2张有效照片 + 1条展项来源 + “已知/未知”各至少2项",
            "goals": "K4(情报与信息差), S3(史料实证), C5(多视角同理)",
            "prerequisites": [],
            "toolType": "capture",
            "image": "lessons/lesson_zhuhun_001/assets/tasks/limited-message.svg",
            "location": {
              "mode": "point",
              "legacyMode": "inherit_role",
              "name": "亲历者回忆与士兵生活展区",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "中国共产党历史展览馆课程动线内",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "task-2",
            "roleStageId": "task-2",
            "name": "译行动",
            "phase": "Phase 2 展陈采证",
            "modules": "A02(表单), A05(组内讨论)",
            "tools": [
              {
                "id": "quiz",
                "module": "A02",
                "name": "答题评测",
                "icon": "list-checks",
                "output": "answers",
                "config": {
                  "type": "open_response",
                  "question": "",
                  "options": []
                }
              },
              {
                "id": "team",
                "module": "A05",
                "name": "团队协作",
                "icon": "users",
                "output": "teamLog",
                "config": {
                  "mode": "discussion",
                  "prompt": "",
                  "minimumEntries": 1,
                  "roles": []
                }
              }
            ],
            "requirement": "读取一张经过裁剪的命令卡，填写“要做什么、何时何地、向谁确认、缺什么信息、何时呼叫上级”；与同伴复述并核对差异",
            "guidanceSteps": [
              "完整查看课程提供的裁剪命令卡，只记录卡片明确出现的内容",
              "填写要做什么、何时何地、向谁确认、缺什么信息和何时呼叫上级五项",
              "用20至45秒向同伴复述命令，必须包含动作、时间地点、确认对象和一项未知",
              "让同伴复述刚才听到的内容，并至少记录两条核对结果：一条一致信息和一条差异或待确认信息"
            ],
            "steps": [
              {
                "id": "signal-read-command",
                "title": "阅读裁剪命令",
                "objective": "体验基层行动者只能获得局部命令的信息条件",
                "studentAction": "完整查看课程提供的裁剪命令卡，只记录卡片明确出现的内容",
                "completionMode": "tool_result",
                "evidenceRequirement": "完成命令卡查看；不得使用全局战图补出卡片中没有的行动原因和后续路线",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A06(沉浸媒体)",
                "next": "step:signal-extract-command",
                "tools": [
                  {
                    "id": "media",
                    "module": "A06",
                    "name": "沉浸媒体",
                    "icon": "play",
                    "output": "playback",
                    "config": {
                      "type": "image",
                      "url": "lessons/lesson_zhuhun_001/assets/tasks/limited-message.svg",
                      "poster": "",
                      "title": "课程推演局部命令卡｜只使用卡片当前可见信息",
                      "requireCompletion": true,
                      "prompt": "先独立阅读，不向其他角色索取全局答案；下一步再拆出执行字段。"
                    }
                  }
                ]
              },
              {
                "id": "signal-extract-command",
                "title": "拆出执行字段",
                "objective": "从局部命令中提取能够执行、需要确认和必须上报的信息",
                "studentAction": "填写要做什么、何时何地、向谁确认、缺什么信息和何时呼叫上级五项",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "五项均完成；命令卡没有写明的字段标“缺失/需确认”；至少1项明确不能自行猜测",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字表单)",
                "next": "step:signal-retell-command",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "action",
                          "label": "要做什么",
                          "type": "long_text",
                          "required": true,
                          "placeholder": "只转述命令卡明确动作"
                        },
                        {
                          "id": "when-where",
                          "label": "何时、何地",
                          "type": "short_text",
                          "required": true,
                          "placeholder": "缺失时写“需确认”"
                        },
                        {
                          "id": "confirm-with",
                          "label": "向谁确认",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "missing",
                          "label": "缺什么信息，不能自行猜测",
                          "type": "long_text",
                          "required": true
                        },
                        {
                          "id": "escalate",
                          "label": "何时呼叫上级或老师",
                          "type": "long_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "signal-retell-command",
                "title": "口头复述命令",
                "objective": "检验局部命令经过一次口头传递后是否仍保留关键执行信息",
                "studentAction": "用20至45秒向同伴复述命令，必须包含动作、时间地点、确认对象和一项未知",
                "completionMode": "tool_result",
                "evidenceRequirement": "录音不少于20秒、不超过45秒；包含四类信息；不得添加命令卡中没有的历史人物原话",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(语音记录)",
                "next": "step:signal-compare-retelling",
                "tools": [
                  {
                    "id": "audio",
                    "module": "A01",
                    "name": "语音记录",
                    "icon": "mic",
                    "output": "recording",
                    "config": {
                      "minSeconds": 20,
                      "maxSeconds": 45,
                      "language": "zh-CN",
                      "transcribe": true,
                      "prompt": "像向同伴传达任务一样复述：动作、时间地点、确认对象，以及一项仍未知的信息。"
                    }
                  }
                ]
              },
              {
                "id": "signal-compare-retelling",
                "title": "核对传递差异",
                "objective": "发现命令在复述中可能出现的遗漏、改变和需要再次确认之处",
                "studentAction": "让同伴复述刚才听到的内容，并至少记录两条核对结果：一条一致信息和一条差异或待确认信息",
                "completionMode": "tool_result",
                "evidenceRequirement": "至少2条组内记录；包含1条一致项和1条差异或待确认项；关键地点、时间或对象有差异时标记“暂停并确认”",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A05(团队核对)",
                "next": "role-stage:task-3",
                "tools": [
                  {
                    "id": "team",
                    "module": "A05",
                    "name": "团队协作",
                    "icon": "users",
                    "output": "teamLog",
                    "config": {
                      "mode": "discussion",
                      "prompt": "记录同伴复述后的核对结果：先写一条一致信息，再写一条遗漏、改变或待确认信息。",
                      "minimumEntries": 2,
                      "roles": [
                        "原始复述者",
                        "同伴复述者",
                        "核对记录者"
                      ],
                      "recordTypes": [
                        "一致信息",
                        "遗漏或改变",
                        "待确认信息"
                      ],
                      "requiredRecordTypes": [
                        "一致信息",
                        "遗漏或改变"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "五项信息完整 + 完成1次同伴复述核对 + 标记至少1项不能自行猜测的内容",
            "passCondition": "五项信息完整 + 完成1次同伴复述核对 + 标记至少1项不能自行猜测的内容",
            "goals": "S4(信息不对称分析), C4(民主与担当), C5(多视角同理)",
            "prerequisites": [],
            "toolType": "form",
            "image": "lessons/lesson_zhuhun_001/assets/tasks/limited-message.svg",
            "location": {
              "mode": "point",
              "legacyMode": "inherit_role",
              "name": "亲历者回忆与士兵生活展区",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "中国共产党历史展览馆课程动线内",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          },
          {
            "id": "task-3",
            "roleStageId": "task-3",
            "name": "写边界",
            "phase": "Phase 2 展陈采证",
            "modules": "A01(文字/语音), A02(证据标注)",
            "tools": [
              {
                "id": "audio",
                "module": "A01",
                "name": "语音记录",
                "icon": "mic",
                "output": "recording",
                "config": {
                  "minSeconds": 3,
                  "maxSeconds": 90,
                  "language": "zh-CN",
                  "transcribe": true
                }
              },
              {
                "id": "text",
                "module": "A01",
                "name": "文字表单",
                "icon": "notebook-pen",
                "output": "fields",
                "config": {
                  "fields": [
                    {
                      "id": "observation",
                      "label": "观察记录",
                      "type": "long_text",
                      "required": true
                    }
                  ]
                }
              },
              {
                "id": "quiz",
                "module": "A02",
                "name": "答题评测",
                "icon": "list-checks",
                "output": "answers",
                "config": {
                  "type": "single_choice",
                  "question": "",
                  "options": []
                }
              }
            ],
            "requirement": "以基层视角写一段80—150字行动记录，只写角色当时可能知道、看到或被告知的内容；每句话标记史料依据、合理推断或未知",
            "guidanceSteps": [
              "写一段80至150字的行动记录，只写角色当时可能知道、看到或被告知的内容",
              "将6张句子序号卡放入三种来源区域；不足6句时把多余卡放入“未使用”",
              "选择初稿提交前必须执行的全部检查项"
            ],
            "steps": [
              {
                "id": "signal-write-draft",
                "title": "完成基层记录初稿",
                "objective": "从基层有限视角形成有明确字数和证据边界的行动记录",
                "studentAction": "写一段80至150字的行动记录，只写角色当时可能知道、看到或被告知的内容",
                "completionMode": "ai_evaluation",
                "evidenceRequirement": "80至150字；至少引用任务1展项证据和任务2命令卡各1条；不生成真实历史人物直接引语、姓名或心理活动",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A01(文字表单)",
                "next": "step:signal-label-sentences",
                "tools": [
                  {
                    "id": "text",
                    "module": "A01",
                    "name": "文字表单",
                    "icon": "notebook-pen",
                    "output": "fields",
                    "config": {
                      "fields": [
                        {
                          "id": "draft",
                          "label": "基层行动记录（80—150字）",
                          "type": "long_text",
                          "required": true,
                          "minLength": 80,
                          "maxLength": 150,
                          "placeholder": "可以写“命令只说明……”“我无法确认……”；不要冒充真实人物口述。"
                        },
                        {
                          "id": "source-one",
                          "label": "证据1：展项或照片编号",
                          "type": "short_text",
                          "required": true
                        },
                        {
                          "id": "source-two",
                          "label": "证据2：局部命令卡字段",
                          "type": "short_text",
                          "required": true
                        }
                      ]
                    }
                  }
                ]
              },
              {
                "id": "signal-label-sentences",
                "title": "逐句标记来源",
                "objective": "把初稿中的句子区分为史料依据、合理推断和未知",
                "studentAction": "将6张句子序号卡放入三种来源区域；不足6句时把多余卡放入“未使用”",
                "completionMode": "tool_result",
                "evidenceRequirement": "6张卡全部放置；史料依据、合理推断和未知三个区域均至少使用一次；未使用卡明确归档",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A03(分类搭建)",
                "next": "step:signal-check-boundary",
                "tools": [
                  {
                    "id": "builder",
                    "module": "A03",
                    "name": "拼合搭建",
                    "icon": "blocks",
                    "output": "layout",
                    "config": {
                      "mode": "evidence-wall",
                      "items": [
                        {
                          "id": "sentence-1",
                          "label": "第1句"
                        },
                        {
                          "id": "sentence-2",
                          "label": "第2句"
                        },
                        {
                          "id": "sentence-3",
                          "label": "第3句"
                        },
                        {
                          "id": "sentence-4",
                          "label": "第4句"
                        },
                        {
                          "id": "sentence-5",
                          "label": "第5句"
                        },
                        {
                          "id": "sentence-6",
                          "label": "第6句或未使用"
                        }
                      ],
                      "zones": [
                        {
                          "id": "evidence",
                          "label": "史料依据"
                        },
                        {
                          "id": "inference",
                          "label": "合理推断"
                        },
                        {
                          "id": "unknown",
                          "label": "未知"
                        },
                        {
                          "id": "unused",
                          "label": "未使用"
                        }
                      ],
                      "connections": [],
                      "prompt": "按初稿句子顺序分类；每句话只选一个当前最合适的来源标签。",
                      "bindings": {
                        "sentence-1": {
                          "taskId": "task-3",
                          "stepId": "signal-write-draft",
                          "toolId": "text",
                          "fieldId": "draft",
                          "split": "sentences",
                          "index": 0,
                          "prefix": "第1句："
                        },
                        "sentence-2": {
                          "taskId": "task-3",
                          "stepId": "signal-write-draft",
                          "toolId": "text",
                          "fieldId": "draft",
                          "split": "sentences",
                          "index": 1,
                          "prefix": "第2句："
                        },
                        "sentence-3": {
                          "taskId": "task-3",
                          "stepId": "signal-write-draft",
                          "toolId": "text",
                          "fieldId": "draft",
                          "split": "sentences",
                          "index": 2,
                          "prefix": "第3句："
                        },
                        "sentence-4": {
                          "taskId": "task-3",
                          "stepId": "signal-write-draft",
                          "toolId": "text",
                          "fieldId": "draft",
                          "split": "sentences",
                          "index": 3,
                          "prefix": "第4句："
                        },
                        "sentence-5": {
                          "taskId": "task-3",
                          "stepId": "signal-write-draft",
                          "toolId": "text",
                          "fieldId": "draft",
                          "split": "sentences",
                          "index": 4,
                          "prefix": "第5句："
                        },
                        "sentence-6": {
                          "taskId": "task-3",
                          "stepId": "signal-write-draft",
                          "toolId": "text",
                          "fieldId": "draft",
                          "split": "sentences",
                          "index": 5,
                          "prefix": "第6句："
                        }
                      },
                      "zoneMinimums": {
                        "evidence": 1,
                        "inference": 1,
                        "unknown": 1
                      }
                    }
                  }
                ]
              },
              {
                "id": "signal-check-boundary",
                "title": "完成边界检查",
                "objective": "在提交前排除虚构直接引语和越过基层视角的信息",
                "studentAction": "选择初稿提交前必须执行的全部检查项",
                "completionMode": "tool_result",
                "evidenceRequirement": "正确选择来源标记、信息范围、直接引语和未知保留四项检查",
                "location": {
                  "mode": "none",
                  "name": "",
                  "coordinates": null,
                  "radiusMeters": null,
                  "minDwellSeconds": 0,
                  "verification": "none"
                },
                "modules": "A02(多选答题)",
                "next": "role-stage:complete",
                "tools": [
                  {
                    "id": "quiz",
                    "module": "A02",
                    "name": "答题评测",
                    "icon": "list-checks",
                    "output": "answers",
                    "config": {
                      "type": "multiple_choice",
                      "question": "基层行动记录提交前，需要完成哪些检查？",
                      "options": [
                        "每句话标明史料依据、合理推断或未知",
                        "删除角色当时不可能知道的全局路线",
                        "没有可靠来源的历史人物直接引语改为转述或删除",
                        "允许保留“我无法确认”的信息边界",
                        "加入更多战场细节，让文本更像真实回忆"
                      ]
                    }
                  }
                ]
              }
            ],
            "completionMode": "tool_result",
            "finalizationMode": "auto_on_last_step",
            "evidenceRequirement": "达到字数 + 至少引用2条证据 + 三类边界标记完整 + 无虚构直接引语",
            "passCondition": "达到字数 + 至少引用2条证据 + 三类边界标记完整 + 无虚构直接引语",
            "goals": "S3(史料实证), S6(因果表达), C3(证据边界), C5(多视角同理)",
            "prerequisites": [],
            "toolType": "audio",
            "image": "lessons/lesson_zhuhun_001/assets/tasks/limited-message.svg",
            "location": {
              "mode": "point",
              "legacyMode": "inherit_role",
              "name": "亲历者回忆与士兵生活展区",
              "coordinates": null,
              "radiusMeters": null,
              "geofence": "中国共产党历史展览馆课程动线内",
              "verification": "manual",
              "minDwellSeconds": 0,
              "inherited": true
            },
            "timing": {
              "suggestedSeconds": 900,
              "idleNudgeSeconds": 480,
              "nudgeCooldownSeconds": 480
            },
            "nudgePolicy": {
              "maxNudges": 1
            },
            "advanceMode": "auto_after_validation"
          }
        ],
        "cardImage": "lessons/lesson_zhuhun_001/assets/roles/role-card-signaler.png",
        "badgeImage": "lessons/lesson_zhuhun_001/assets/roles/badge-signaler.png"
      }
    ],
    "timeBank": {
      "enabled": true,
      "initialBalance": 0,
      "currencyUnit": "分钟",
      "earnRules": {
        "maxTotal": 15,
        "maxPerTask": 3,
        "tasksVisibleAtOnce": 3
      },
      "giftRules": {
        "allowGiftToSelf": false,
        "maxPerAction": 5,
        "minAmount": 1,
        "target": "same_group_only"
      },
      "tasks": [
        {
          "id": "tb-01",
          "type": "quiz",
          "question": "遵义会议召开于哪一年？",
          "options": [
            "1934",
            "1935",
            "1936"
          ],
          "answerType": "",
          "hint": "",
          "reward": 1,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-02",
          "type": "quiz",
          "question": "四渡赤水主要发生在哪三省交界区域？",
          "options": [
            "川黔滇",
            "湘鄂赣",
            "陕甘宁"
          ],
          "answerType": "",
          "hint": "",
          "reward": 2,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-03",
          "type": "quiz",
          "question": "哪一种表达更符合课程的数据边界？",
          "options": [
            "红军始终正好3万人",
            "红军约3万人且兵力随时点变化",
            "红军人数不重要"
          ],
          "answerType": "",
          "hint": "",
          "reward": 2,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-04",
          "type": "quiz",
          "question": "分析历史决策时，应该优先使用哪类信息？",
          "options": [
            "当时可获得的证据",
            "已知的最终结果",
            "网络上最短的答案"
          ],
          "answerType": "",
          "hint": "",
          "reward": 2,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-05",
          "type": "photo_checkpoint",
          "question": "找到一处长征路线地图或地形模型，并拍摄不含其他参观者正脸的局部照片",
          "options": [],
          "answerType": "",
          "hint": "遵守展馆当日拍摄规定，不使用闪光灯",
          "reward": 3,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-06",
          "type": "photo_checkpoint",
          "question": "找到一项带有明确日期的长征展项，记录日期和展项标题",
          "options": [],
          "answerType": "",
          "hint": "照片之外再写一句文字，说明日期对应的事件",
          "reward": 2,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": true
        },
        {
          "id": "tb-07",
          "type": "photo_checkpoint",
          "question": "找到一项通信、情报或电文相关展项，拍摄展项说明",
          "options": [],
          "answerType": "",
          "hint": "只拍允许拍摄的公开展项",
          "reward": 2,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-08",
          "type": "location_checkin",
          "question": "到达中国共产党历史展览馆课程集合区域",
          "options": [],
          "answerType": "",
          "hint": "",
          "reward": 1,
          "unlockAfter": "phase2-start",
          "minLength": 0,
          "requiresText": false
        },
        {
          "id": "tb-09",
          "type": "quiz",
          "question": "写出一条你在展陈中看到的证据，并说明它属于史实、课程材料还是你的推断。",
          "options": [],
          "answerType": "open_ended",
          "hint": "",
          "reward": 3,
          "unlockAfter": "phase2-start",
          "minLength": 25,
          "requiresText": false
        },
        {
          "id": "tb-10",
          "type": "quiz",
          "question": "新证据出现后，你的小组改变过哪一个判断？为什么？",
          "options": [],
          "answerType": "open_ended",
          "hint": "",
          "reward": 3,
          "unlockAfter": "phase3-start",
          "minLength": 30,
          "requiresText": false
        }
      ]
    },
    "assets": {
      "cover": "lessons/lesson_zhuhun_001/assets/backgrounds/cover.png",
      "chat": "lessons/lesson_zhuhun_001/assets/backgrounds/chat-bg.png",
      "transition": "lessons/lesson_zhuhun_001/assets/backgrounds/phase-transition.png",
      "certificate": "lessons/lesson_zhuhun_001/assets/backgrounds/certificate-bg.png",
      "navigationMap": "lessons/lesson_zhuhun_001/assets/maps/museum-navigation.png",
      "importPlaceholder": "lessons/lesson_zhuhun_001/assets/videos/video-opening.jpg",
      "simulationPlaceholder": "lessons/lesson_zhuhun_001/assets/videos/video-strategy-table.jpg"
    }
  }
};
