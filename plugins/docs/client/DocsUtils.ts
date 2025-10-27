import { app } from '@client/AppService';
import { DBKeys, PageNames } from '@client/AppServiceTypes';
import { alertModal } from '@client/components/AlertModalComp';
import { idb } from '@client/IndexedDB';
import { DocsGlobalState, gd, DocsPageNames } from './DocsTypes';

export async function docsGoHome(gs: DocsGlobalState): Promise<void> {
    gs.pages = [DocsPageNames.treeViewer];
    const userId = await idb.getItem(DBKeys.userId);
    if (!userId) {
        alertModal(`You do not have a User Profile saved yet. Please enter at least a user name.`);
        app.goToPage(PageNames.settings)
    }
    else {
        gs.docsFolder = "/"+gs.userProfile!.name || ''; 
        // console.log(`Going home to folder: [${gs.docsFolder}]`);
        gd({ type: 'docsGoHome', payload: gs });
    }
}