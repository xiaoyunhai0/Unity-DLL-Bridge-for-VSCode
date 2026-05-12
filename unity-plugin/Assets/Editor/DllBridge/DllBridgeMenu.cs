using System.IO;
using UnityEditor;
using UnityEngine;

namespace UnityDllBridge.Editor
{
    public static class DllBridgeMenu
    {
        [MenuItem("Tools/DLL Bridge/Refresh")]
        public static void Refresh()
        {
            AssetDatabase.Refresh();
            Debug.Log("[DLL Bridge] AssetDatabase.Refresh completed.");
        }

        [MenuItem("Tools/DLL Bridge/Show Current DLL Info")]
        public static void ShowCurrentDllInfo()
        {
            DllBridgeManifestWindow.ShowWindow();
        }

        [MenuItem("Tools/DLL Bridge/Open Plugins Folder")]
        public static void OpenPluginsFolder()
        {
            var pluginsPath = Path.Combine(Application.dataPath, "Plugins");

            if (!Directory.Exists(pluginsPath))
            {
                Directory.CreateDirectory(pluginsPath);
                AssetDatabase.Refresh();
            }

            EditorUtility.RevealInFinder(pluginsPath);
        }
    }
}
