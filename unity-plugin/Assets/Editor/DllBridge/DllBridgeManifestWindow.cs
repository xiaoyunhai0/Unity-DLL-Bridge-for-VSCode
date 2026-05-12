using System;
using System.Collections.Generic;
using System.IO;
using UnityEditor;
using UnityEngine;

namespace UnityDllBridge.Editor
{
    public sealed class DllBridgeManifestWindow : EditorWindow
    {
        private readonly List<ManifestInfo> manifests = new List<ManifestInfo>();
        private Vector2 scrollPosition;
        private GUIStyle titleStyle;
        private GUIStyle mutedStyle;
        private GUIStyle pillStyle;

        public static void ShowWindow()
        {
            var window = GetWindow<DllBridgeManifestWindow>("DLL Bridge");
            window.minSize = new Vector2(520, 320);
            window.RefreshManifestList();
            window.Show();
        }

        private void OnEnable()
        {
            RefreshManifestList();
        }

        private void OnGUI()
        {
            EnsureStyles();
            DrawToolbar();
            DrawHeader();

            if (manifests.Count == 0)
            {
                DrawEmptyState();
                return;
            }

            DrawManifestList();
        }

        private void DrawToolbar()
        {
            using (new EditorGUILayout.HorizontalScope(EditorStyles.toolbar))
            {
                if (GUILayout.Button("Refresh", EditorStyles.toolbarButton, GUILayout.Width(80)))
                {
                    RefreshManifestList();
                }

                GUILayout.FlexibleSpace();

                if (GUILayout.Button("Open Plugins", EditorStyles.toolbarButton, GUILayout.Width(96)))
                {
                    DllBridgeMenu.OpenPluginsFolder();
                }
            }
        }

        private void DrawHeader()
        {
            EditorGUILayout.Space(10);
            EditorGUILayout.LabelField("DLL Bridge Manifests", titleStyle);
            EditorGUILayout.LabelField("Read synced DLL metadata from Assets/Plugins/**/manifest.json.", mutedStyle);
            EditorGUILayout.Space(8);

            using (new EditorGUILayout.HorizontalScope())
            {
                DrawSummary("Manifests", manifests.Count.ToString());
                DrawSummary("Files", CountFiles().ToString());
                DrawSummary("Errors", CountErrors().ToString());
            }

            EditorGUILayout.Space(8);
        }

        private void DrawEmptyState()
        {
            EditorGUILayout.BeginVertical(EditorStyles.helpBox);
            EditorGUILayout.LabelField("No manifest files found", EditorStyles.boldLabel);
            EditorGUILayout.LabelField("Run Unity DLL Bridge: Sync Only or Build & Sync in VSCode, then refresh this window.", mutedStyle);
            EditorGUILayout.Space(8);

            using (new EditorGUILayout.HorizontalScope())
            {
                if (GUILayout.Button("Refresh", GUILayout.Width(120)))
                {
                    RefreshManifestList();
                }

                if (GUILayout.Button("Open Plugins Folder", GUILayout.Width(160)))
                {
                    DllBridgeMenu.OpenPluginsFolder();
                }
            }

            EditorGUILayout.EndVertical();
        }

        private void DrawManifestList()
        {
            scrollPosition = EditorGUILayout.BeginScrollView(scrollPosition);

            foreach (var manifest in manifests)
            {
                DrawManifest(manifest);
            }

            EditorGUILayout.EndScrollView();
        }

        private void RefreshManifestList()
        {
            manifests.Clear();

            var pluginsPath = Path.Combine(Application.dataPath, "Plugins");
            if (!Directory.Exists(pluginsPath))
            {
                Repaint();
                return;
            }

            foreach (var manifestPath in Directory.GetFiles(pluginsPath, "manifest.json", SearchOption.AllDirectories))
            {
                manifests.Add(ManifestInfo.Load(manifestPath));
            }

            manifests.Sort((left, right) => string.Compare(left.AssetRelativePath, right.AssetRelativePath, StringComparison.OrdinalIgnoreCase));
            Repaint();
        }

        private void DrawManifest(ManifestInfo manifest)
        {
            EditorGUILayout.BeginVertical(EditorStyles.helpBox);

            using (new EditorGUILayout.HorizontalScope())
            {
                EditorGUILayout.LabelField(manifest.DisplayName, EditorStyles.boldLabel);
                GUILayout.FlexibleSpace();
                GUILayout.Label(string.IsNullOrEmpty(manifest.Configuration) ? "Unknown" : manifest.Configuration, pillStyle);
            }

            EditorGUILayout.Space(2);
            DrawValue("Path", manifest.AssetRelativePath);
            DrawValue("Configuration", manifest.Configuration);
            DrawValue("Sync Time", manifest.SyncTime);
            DrawValue("Source Project", manifest.SourceProject);
            DrawValue("Target", manifest.TargetPath);

            if (!string.IsNullOrEmpty(manifest.Error))
            {
                EditorGUILayout.HelpBox(manifest.Error, MessageType.Warning);
            }

            using (new EditorGUILayout.HorizontalScope())
            {
                if (GUILayout.Button("Open Manifest", GUILayout.Width(120)))
                {
                    OpenFile(manifest.FullPath);
                }

                if (GUILayout.Button("Reveal", GUILayout.Width(80)))
                {
                    EditorUtility.RevealInFinder(manifest.FullPath);
                }
            }

            if (manifest.Files.Count > 0)
            {
                EditorGUILayout.Space(4);
                EditorGUILayout.LabelField("Files", EditorStyles.boldLabel);

                using (new EditorGUILayout.HorizontalScope(EditorStyles.toolbar))
                {
                    GUILayout.Label("Name", GUILayout.MinWidth(160));
                    GUILayout.Label("Size", GUILayout.Width(90));
                    GUILayout.Label("SHA256", GUILayout.MinWidth(120));
                }

                foreach (var file in manifest.Files)
                {
                    using (new EditorGUILayout.HorizontalScope())
                    {
                        EditorGUILayout.SelectableLabel(file.Name, GUILayout.MinWidth(160), GUILayout.Height(EditorGUIUtility.singleLineHeight));
                        EditorGUILayout.SelectableLabel(FormatBytes(file.Size), GUILayout.Width(90), GUILayout.Height(EditorGUIUtility.singleLineHeight));
                        EditorGUILayout.SelectableLabel(ShortHash(file.Sha256), GUILayout.MinWidth(120), GUILayout.Height(EditorGUIUtility.singleLineHeight));
                    }
                }
            }

            EditorGUILayout.EndVertical();
            EditorGUILayout.Space(6);
        }

        private static void DrawValue(string label, string value)
        {
            EditorGUILayout.BeginHorizontal();
            EditorGUILayout.LabelField(label, GUILayout.Width(120));
            EditorGUILayout.SelectableLabel(string.IsNullOrEmpty(value) ? "-" : value, GUILayout.Height(EditorGUIUtility.singleLineHeight));
            EditorGUILayout.EndHorizontal();
        }

        private void DrawSummary(string label, string value)
        {
            EditorGUILayout.BeginVertical(EditorStyles.helpBox, GUILayout.MinWidth(120));
            EditorGUILayout.LabelField(label, mutedStyle);
            EditorGUILayout.LabelField(value, EditorStyles.boldLabel);
            EditorGUILayout.EndVertical();
        }

        private void EnsureStyles()
        {
            if (titleStyle != null)
            {
                return;
            }

            titleStyle = new GUIStyle(EditorStyles.boldLabel)
            {
                fontSize = 16
            };

            mutedStyle = new GUIStyle(EditorStyles.miniLabel)
            {
                wordWrap = true
            };

            pillStyle = new GUIStyle(EditorStyles.miniButton)
            {
                alignment = TextAnchor.MiddleCenter,
                fixedWidth = 76
            };
        }

        private int CountFiles()
        {
            var count = 0;

            foreach (var manifest in manifests)
            {
                count += manifest.Files.Count;
            }

            return count;
        }

        private int CountErrors()
        {
            var count = 0;

            foreach (var manifest in manifests)
            {
                if (!string.IsNullOrEmpty(manifest.Error))
                {
                    count += 1;
                }
            }

            return count;
        }

        private static void OpenFile(string path)
        {
            if (!File.Exists(path))
            {
                EditorUtility.DisplayDialog("DLL Bridge", "Manifest file does not exist.", "OK");
                return;
            }

            EditorUtility.OpenWithDefaultApp(path);
        }

        private static string ShortHash(string hash)
        {
            if (string.IsNullOrEmpty(hash))
            {
                return "-";
            }

            return hash.Length <= 12 ? hash : hash.Substring(0, 12);
        }

        private static string FormatBytes(long bytes)
        {
            if (bytes < 1024)
            {
                return bytes + " B";
            }

            if (bytes < 1024 * 1024)
            {
                return (bytes / 1024f).ToString("0.0") + " KB";
            }

            return (bytes / 1024f / 1024f).ToString("0.0") + " MB";
        }

        [Serializable]
        private sealed class ManifestJson
        {
            public string name;
            public string assemblyName;
            public string configuration;
            public string syncTime;
            public string sourceProject;
            public string targetPath;
            public ManifestFile[] files;
        }

        [Serializable]
        private sealed class ManifestFile
        {
            public string name;
            public string sha256;
            public long size;
        }

        private sealed class ManifestInfo
        {
            public string DisplayName;
            public string AssetRelativePath;
            public string Configuration;
            public string SyncTime;
            public string SourceProject;
            public string TargetPath;
            public string Error;
            public string FullPath;
            public readonly List<ManifestFile> Files = new List<ManifestFile>();

            public static ManifestInfo Load(string manifestPath)
            {
                var info = new ManifestInfo
                {
                    FullPath = manifestPath,
                    AssetRelativePath = ToAssetRelativePath(manifestPath)
                };

                try
                {
                    var json = File.ReadAllText(manifestPath);
                    var manifest = JsonUtility.FromJson<ManifestJson>(json);
                    info.DisplayName = string.IsNullOrEmpty(manifest.name) ? manifest.assemblyName : manifest.name;
                    info.Configuration = manifest.configuration;
                    info.SyncTime = manifest.syncTime;
                    info.SourceProject = manifest.sourceProject;
                    info.TargetPath = manifest.targetPath;

                    if (manifest.files != null)
                    {
                        info.Files.AddRange(manifest.files);
                    }
                }
                catch (Exception exception)
                {
                    info.DisplayName = Path.GetFileName(Path.GetDirectoryName(manifestPath));
                    info.Error = exception.Message;
                }

                return info;
            }

            private static string ToAssetRelativePath(string fullPath)
            {
                var normalizedFullPath = fullPath.Replace('\\', '/');
                var normalizedDataPath = Application.dataPath.Replace('\\', '/');

                if (normalizedFullPath.StartsWith(normalizedDataPath, StringComparison.OrdinalIgnoreCase))
                {
                    return "Assets" + normalizedFullPath.Substring(normalizedDataPath.Length);
                }

                return fullPath;
            }
        }
    }
}
