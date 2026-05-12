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
            using (new EditorGUILayout.HorizontalScope(EditorStyles.toolbar))
            {
                if (GUILayout.Button("Refresh", EditorStyles.toolbarButton, GUILayout.Width(80)))
                {
                    RefreshManifestList();
                }

                GUILayout.FlexibleSpace();
                GUILayout.Label("manifest.json", EditorStyles.miniLabel);
            }

            if (manifests.Count == 0)
            {
                EditorGUILayout.HelpBox("No DLL Bridge manifest.json files were found under Assets/Plugins.", MessageType.Info);
                return;
            }

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

        private static void DrawManifest(ManifestInfo manifest)
        {
            EditorGUILayout.BeginVertical(EditorStyles.helpBox);
            EditorGUILayout.LabelField(manifest.DisplayName, EditorStyles.boldLabel);
            DrawValue("Path", manifest.AssetRelativePath);
            DrawValue("Configuration", manifest.Configuration);
            DrawValue("Sync Time", manifest.SyncTime);
            DrawValue("Source Project", manifest.SourceProject);
            DrawValue("Target", manifest.TargetPath);

            if (!string.IsNullOrEmpty(manifest.Error))
            {
                EditorGUILayout.HelpBox(manifest.Error, MessageType.Warning);
            }

            if (manifest.Files.Count > 0)
            {
                EditorGUILayout.Space(4);
                EditorGUILayout.LabelField("Files", EditorStyles.boldLabel);

                foreach (var file in manifest.Files)
                {
                    DrawValue(file.Name, string.Format("{0} bytes  {1}", file.Size, ShortHash(file.Sha256)));
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

        private static string ShortHash(string hash)
        {
            if (string.IsNullOrEmpty(hash))
            {
                return "-";
            }

            return hash.Length <= 12 ? hash : hash.Substring(0, 12);
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
            public readonly List<ManifestFile> Files = new List<ManifestFile>();

            public static ManifestInfo Load(string manifestPath)
            {
                var info = new ManifestInfo
                {
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
