module.exports = {
  aclFilterFolderList: function(folders, user) {
    if (!user.admin) {
      for (var fid in folders) {
        if (!(user.acl.indexOf(fid) >= 0)) {
          delete folders[fid];
        }
      }
    }

    return folders;
  }
}
